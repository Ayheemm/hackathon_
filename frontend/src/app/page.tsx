import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16 sm:px-10">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-10 shadow-2xl shadow-slate-950/30">
          <span className="inline-flex items-center rounded-full bg-cyan-500/15 px-3 py-1 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-200/20">
            Legal RAG Frontend
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Tunisian Legal Assistant Launcher
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300">
            This is the frontend shell for your future Next.js app. The actual RAG chatbot is served by the Python backend at <span className="font-semibold text-white">http://127.0.0.1:7860</span>.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="http://127.0.0.1:7860"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Open RAG Chat UI
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:border-slate-500"
            >
              Frontend placeholder
            </Link>
          </div>

          <div className="mt-12 rounded-3xl border border-slate-800 bg-slate-950/80 p-6">
            <h2 className="text-xl font-semibold text-white">How to use</h2>
            <ol className="mt-4 space-y-3 text-slate-300">
              <li>1. Start the Python backend: <code className="rounded bg-slate-900 px-2 py-1 text-sm text-cyan-200">.\\.venv\\Scripts\\python.exe app.py</code></li>
              <li>2. Open the chat UI at <strong>http://127.0.0.1:7860</strong>.</li>
              <li>3. Use this page as the future Next.js frontend launcher.</li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
