import urllib.request
import urllib.error

base='https://allrichai-farmgame-backend.onrender.com/api/viz/state'
origins=['https://funloom.kurangames.com','https://allrichai-farmgame-backend.onrender.com']

for origin in origins:
    print(f'=== Origin: {origin} ===')
    for method in ['OPTIONS','GET']:
        headers={'Origin': origin, 'User-Agent':'AllRichAI-CORS-Debug/1.0'}
        if method=='OPTIONS':
            headers['Access-Control-Request-Method']='GET'
            headers['Access-Control-Request-Headers']='Content-Type,Authorization'
        req=urllib.request.Request(base, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                h=dict(r.headers.items())
                print(f'[{method}] status={r.status} ACAO={h.get("Access-Control-Allow-Origin")} ACAM={h.get("Access-Control-Allow-Methods")} ACAH={h.get("Access-Control-Allow-Headers")} Vary={h.get("Vary")}')
        except urllib.error.HTTPError as e:
            h=dict(e.headers.items()) if e.headers else {}
            print(f'[{method}] status={e.code} ACAO={h.get("Access-Control-Allow-Origin")} ACAM={h.get("Access-Control-Allow-Methods")} ACAH={h.get("Access-Control-Allow-Headers")} Vary={h.get("Vary")}')
    print()
