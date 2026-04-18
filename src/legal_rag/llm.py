import json
import re
import subprocess
import requests
from pathlib import Path
from typing import Optional, Union, List


class LlamaCppGenerator:
    def __init__(self, model_path: Path, n_ctx: int = 4096, n_threads: int = 4, n_gpu_layers: int = 0):
        if not model_path.exists():
            raise FileNotFoundError(f"Missing GGUF model: {model_path}")

        try:
            from llama_cpp import Llama
        except ImportError as exc:
            raise ImportError(
                "llama-cpp-python is not installed. Install it from requirements-llm.txt or pip."
            ) from exc

        self._llm = Llama(
            model_path=str(model_path),
            n_ctx=n_ctx,
            n_threads=n_threads,
            n_gpu_layers=n_gpu_layers,
            verbose=False,
        )

    def generate(self, prompt: str, max_tokens: int = 512, temperature: float = 0.1) -> str:
        response = self._llm(
            prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            stop=["</s>", "[INST]"],
        )
        return response["choices"][0]["text"].strip()


class OllamaGenerator:
    def __init__(self, model_ref: str):
        self.model_ref = self._normalize_model_ref(model_ref)
        self.is_ollama = True
        self._ensure_cli_available()
        self._ensure_model_available()

    @staticmethod
    def _normalize_model_ref(model_ref: str) -> str:
        if model_ref.lower().startswith("ollama://"):
            return model_ref.split("//", 1)[1]
        return model_ref

    @staticmethod
    def _ensure_cli_available() -> None:
        try:
            subprocess.run(
                ["ollama", "--help"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=True,
            )
        except FileNotFoundError as exc:
            raise FileNotFoundError(
                "Ollama CLI is not installed or not available on PATH. "
                "Install Ollama and ensure the `ollama` command works."
            ) from exc
        except subprocess.CalledProcessError as exc:
            raise RuntimeError(
                "Unable to execute the Ollama CLI. Check your Ollama installation."
            ) from exc

    def _ensure_model_available(self) -> None:
        result = subprocess.run(
            ["ollama", "list"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=True,
        )
        if self.model_ref not in result.stdout:
            raise FileNotFoundError(
                f"Ollama model '{self.model_ref}' not found. Run `ollama list` to verify installed models."
            )

    def _repair_json_like_output(self, output: str) -> str:
        start = output.find("{")
        end = output.rfind("}")
        if start == -1 or end == -1 or start >= end:
            return output

        json_text = output[start:end + 1]
        repaired = []
        in_string = False
        escape = False

        for ch in json_text:
            if in_string:
                if escape:
                    repaired.append(ch)
                    escape = False
                elif ch == "\\":
                    repaired.append(ch)
                    escape = True
                elif ch == '"':
                    repaired.append(ch)
                    in_string = False
                elif ch == "\n":
                    repaired.append("\\n")
                elif ch == "\r":
                    repaired.append("\\r")
                elif ch == "\t":
                    repaired.append("\\t")
                elif ord(ch) < 0x20:
                    repaired.append(f"\\u{ord(ch):04x}")
                else:
                    repaired.append(ch)
            else:
                repaired.append(ch)
                if ch == '"':
                    in_string = True

        return ''.join(repaired)

    def generate(self, prompt: str, max_tokens: int = 512, temperature: float = 0.1, images: Optional[List[str]] = None) -> str:
        url = "http://localhost:11434/api/generate"
        payload = {
            "model": self.model_ref,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
                "hidethinking": True,
            }
        }
        if images:
            payload["images"] = images
            
        try:
            res = requests.post(url, json=payload, timeout=120)
            res.raise_for_status()
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Ollama generation failed: {e}")
            
        data = res.json()
        output = data.get("response", "") or data.get("thinking", "")

        output = self._clean_ollama_output(output)
        if not output:
            raise RuntimeError("Ollama returned an empty response.")

        if output.lstrip().startswith("{") or output.lstrip().startswith("["):
            try:
                parsed = json.loads(output)
            except json.JSONDecodeError:
                repaired = self._repair_json_like_output(output)
                try:
                    parsed = json.loads(repaired)
                except json.JSONDecodeError as exc:
                    raise RuntimeError(
                        f"Ollama returned invalid JSON after repair: {exc}\nRaw output:\n{output}"
                    ) from exc

            model_response = self._extract_model_response(parsed)
            if model_response is None:
                raise RuntimeError(
                    f"Ollama returned an unexpected JSON structure: {parsed}"
                )
            return str(model_response).strip()

        return output.strip()

    @staticmethod
    def _strip_ansi_sequences(text: str) -> str:
        # Remove ANSI escape sequences that may appear in Ollama output.
        return re.sub(r"\x1B\[[0-?]*[ -/]*[@-~]", "", text)

    @staticmethod
    def _clean_ollama_output(output: str) -> str:
        text = output.strip()
        if not text:
            return text

        text = OllamaGenerator._strip_ansi_sequences(text)
        # Remove known thinking artifacts from Ollama's default output.
        text = re.sub(r"^Thinking\.\.\.\s*", "", text, flags=re.IGNORECASE | re.MULTILINE)
        text = re.sub(r"\.\.\.done thinking\.\s*", "", text, flags=re.IGNORECASE)
        text = text.strip()
        return text

    @staticmethod
    def _extract_model_response(parsed: object) -> Optional[str]:
        if isinstance(parsed, str):
            return parsed
        if isinstance(parsed, list):
            return "\n".join(str(item) for item in parsed)
        if isinstance(parsed, dict):
            for key in ["model", "response", "text", "answer", "conclusion", "final", "result"]:
                if key in parsed and parsed[key] is not None:
                    return str(parsed[key])
            # If there is a reasoning-style response, join available string fields.
            text_parts = []
            for key in ["conclusion", "analysis", "reasoning", "task"]:
                if key in parsed and isinstance(parsed[key], str):
                    text_parts.append(parsed[key].strip())
            if text_parts:
                return "\n\n".join(text_parts)
        return None


def _looks_like_ollama_ref(model_ref: str) -> bool:
    if model_ref.lower().startswith("ollama://"):
        return True
    if ":" in model_ref and "\\" not in model_ref and "/" not in model_ref:
        return True
    return False


def load_generator_if_available(model_ref: Optional[Union[str, Path]]) -> Optional[Union[LlamaCppGenerator, OllamaGenerator]]:
    if model_ref is None:
        return None
    if isinstance(model_ref, Path):
        if model_ref.exists():
            return LlamaCppGenerator(model_path=model_ref)
        model_ref = str(model_ref)

    if _looks_like_ollama_ref(model_ref):
        return OllamaGenerator(model_ref=model_ref)

    path = Path(model_ref)
    if path.exists():
        return LlamaCppGenerator(model_path=path)

    return None
