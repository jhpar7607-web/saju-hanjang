# 정적 웹(깃허브 무료 주소용) 브라우저 점검
# 사용법: 정적 빌드 후  python3 scripts/e2e-static.py
import http.server, os, socketserver, sys, tempfile, threading
from playwright.sync_api import sync_playwright

ROOT = tempfile.mkdtemp()
os.symlink(os.path.abspath('out'), os.path.join(ROOT, 'saju-hanjang'))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass

socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 3300), Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:3300/saju-hanjang'
results = []

def check(name, cond, detail=''):
    results.append(bool(cond)); print('통과' if cond else '실패', name, detail)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
    ctx = browser.new_context(viewport={'width': 360, 'height': 800}, locale='ko-KR')
    page = ctx.new_page()
    errors, calls = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('request', lambda r: calls.append(r.url) if '/api/' in r.url else None)
    bad = []
    page.on('response', lambda r: bad.append(f'{r.status} {r.url}') if r.status >= 400 else None)

    page.goto(BASE + '/?app=1')
    check('첫 화면 열림', '가입 없이 30초' in page.inner_text('h1'))
    page.click('text=내 사주 보기'); page.wait_for_url('**/input/**')
    page.fill('#year', '1992')
    page.select_option('select[aria-label="태어난 달"]', '10')
    page.select_option('select[aria-label="태어난 날"]', '24')
    page.select_option('select[aria-label="시"]', '5')
    page.select_option('select[aria-label="분"]', '30')
    page.click('button:has-text("남성")')
    page.click('button[type=submit]')
    page.wait_for_url('**/result/**'); page.wait_for_selector('.chart')
    han = page.eval_on_selector_all('.cell .han', 'els => els.map(e => e.textContent).join("")')
    check('휴대폰 안에서 계산한 여덟 글자', han == '乙卯癸酉庚戌壬申', han)
    check('무료 풀이 표시', '정미년' in page.inner_text('main'))
    check('구매 안내 숨김', page.locator('text=상세 리포트 보기').count() == 0)
    check('가로 넘침 없음', page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
    page.click('text=공유 카드 만들기'); page.wait_for_selector('canvas.preview')
    check('공유 카드 그려짐', page.evaluate('document.querySelector("canvas.preview").width') == 1080)
    check('신고 대신 문의처 안내', page.locator('text=안내 화면의 문의처').count() == 1)

    # 없는 날짜 안내
    page.goto(BASE + '/input/')
    page.wait_for_function('document.querySelector("#year").value === "1992"')
    page.select_option('select[aria-label="태어난 달"]', '2')
    page.select_option('select[aria-label="태어난 날"]', '30')
    page.click('button[type=submit]'); page.wait_for_selector('.error')
    check('없는 날짜 안내', '없는 날짜' in page.inner_text('.error'))

    page.goto(BASE + '/info/')
    check('안내 화면 열림', '이용약관' in page.inner_text('main'))
    m = page.evaluate('fetch(document.querySelector("link[rel=manifest]").href).then(r => r.json())')
    check('홈 화면 추가 정보의 시작 주소', m['start_url'] == '/saju-hanjang/', m['start_url'])
    check('서버 호출 없음', len(calls) == 0, str(calls[:3]))
    check('없는 파일 요청 없음', len(bad) == 0, str(bad[:3]))
    check('화면 오류 없음', len(errors) == 0, '; '.join(errors)[:200])
    browser.close()

srv.shutdown()
print(f'\n총 {len(results)}건 중 통과 {sum(results)}건, 실패 {len(results) - sum(results)}건')
sys.exit(0 if all(results) else 1)
