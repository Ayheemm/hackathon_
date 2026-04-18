import requests, json
url='http://localhost:11434/api/generate'
payload={
    'model':'qwen3.5:4b',
    'prompt':'Hello world',
    'stream':False,
    'options':{'temperature':0.1,'num_predict':50}
}
res=requests.post(url,json=payload,timeout=60)
print('status',res.status_code)
print(res.text)
try:
    print(res.json())
except Exception as e:
    print('json error', e)
