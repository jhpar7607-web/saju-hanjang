# 브라우저로 실제 사용 흐름을 따라가 보는 점검 스크립트
import sys, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3200'
OUT = 'shots'
import os; os.makedirs(OUT, exist_ok=True)
results = []

def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('통과' if cond else '실패'), name, detail)

def no_overflow(page):
    return page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for width in (360, 412):
        ctx = browser.new_context(viewport={'width': width, 'height': 800}, device_scale_factor=2, locale='ko-KR')
        page = ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)

        t0 = time.time()
        page.goto(BASE + '/')
        check(f'[{width}] 첫 화면 제목', '가입 없이 30초' in page.inner_text('h1'))
        check(f'[{width}] 첫 화면 가로 넘침 없음', no_overflow(page))
        if width == 360: page.screenshot(path=f'{OUT}/1_home.png', full_page=True)
        page.click('text=내 사주 보기')
        page.wait_for_url('**/input')

        # 빈 값으로 눌러 안내가 나오는지
        page.click('button[type=submit]')
        check(f'[{width}] 빈 입력 안내', '태어난 해' in page.inner_text('.error'))

        page.fill('#year', '1992')
        page.select_option('select[aria-label="태어난 달"]', '10')
        page.select_option('select[aria-label="태어난 날"]', '24')
        page.select_option('select[aria-label="시"]', '5')
        page.select_option('select[aria-label="분"]', '30')
        page.click('button[type=submit]')
        check(f'[{width}] 성별 미선택 안내', '성별' in page.inner_text('.error'))
        page.click('button:has-text("남성")')
        check(f'[{width}] 입력 화면 가로 넘침 없음', no_overflow(page))
        if width == 360: page.screenshot(path=f'{OUT}/2_input.png', full_page=True)
        page.click('button[type=submit]')
        page.wait_for_url('**/result')
        page.wait_for_selector('.chart')
        took = time.time() - t0
        check(f'[{width}] 첫 화면에서 결과까지 30초 이내', took < 30, f'{took:.1f}초')
        han = page.eval_on_selector_all('.cell .han', 'els => els.map(e => e.textContent).join("")')
        check(f'[{width}] 사주 여덟 글자 표시', han == '乙卯癸酉庚戌壬申', han)
        check(f'[{width}] 결과 화면 가로 넘침 없음', no_overflow(page))
        check(f'[{width}] 참고용 안내 표시', '참고용' in page.inner_text('main'))
        check(f'[{width}] 신고 버튼 표시', page.locator('text=이 풀이 신고하기').count() == 1)
        if width == 360: page.screenshot(path=f'{OUT}/3_result.png', full_page=True)

        # 공유 카드
        page.click('text=공유 카드 만들기')
        page.wait_for_selector('canvas.preview')
        size = page.evaluate('[document.querySelector("canvas.preview").width, document.querySelector("canvas.preview").height]')
        check(f'[{width}] 공유 카드 그려짐', size == [1080, 1350], str(size))
        if width == 360:
            page.locator('canvas.preview').screenshot(path=f'{OUT}/4_card.png')
        blank = page.evaluate('''() => { const c=document.querySelector("canvas.preview"); const d=c.getContext("2d").getImageData(500,700,1,1).data; return d[3]===0; }''')
        check(f'[{width}] 공유 카드 내용 있음', not blank)

        # 신고
        page.click('text=이 풀이 신고하기')
        page.click('text=신고 보내기')
        check(f'[{width}] 신고 접수 안내', '접수' in page.inner_text('main'))

        # 결제 (모의)
        page.click('text=상세 리포트 보기')
        page.wait_for_url('**/pay')
        page.wait_for_selector('.price')
        btn = page.locator('button:has-text("결제하기")')
        check(f'[{width}] 동의 전에는 결제 버튼 잠김', btn.is_disabled())
        check(f'[{width}] 결제 화면 가로 넘침 없음', no_overflow(page))
        if width == 360: page.screenshot(path=f'{OUT}/5_pay.png', full_page=True)
        page.check('input[type=checkbox]')
        btn.click()
        page.wait_for_url('**/report/**', timeout=30000)
        page.wait_for_selector('#sec-guide')
        check(f'[{width}] 리포트 목차 8개', page.locator('section[aria-labelledby^="sec-"]').count() == 8)
        check(f'[{width}] 월별 흐름 12개', page.locator('.month').count() == 12)
        check(f'[{width}] 리포트 화면 가로 넘침 없음', no_overflow(page))
        if width == 360: page.screenshot(path=f'{OUT}/6_report.png', full_page=True)
        url = page.url
        # 다시 접속해도 열리는지
        page2 = ctx.new_page(); page2.goto(url); page2.wait_for_selector('#sec-total')
        check(f'[{width}] 리포트 주소로 다시 열림', True)
        page2.close()

        # 다시 방문 시 입력값 자동 채움
        page.goto(BASE + '/input')
        page.wait_for_function('document.querySelector("#year").value === "1992"')
        check(f'[{width}] 입력값 자동 채움', True)

        # 시간 모름 + 음력 윤달 오류
        page.click('button:has-text("음력")')
        page.check('text=윤달에 태어났어요')
        page.check('text=태어난 시간을 몰라요')
        page.click('button[type=submit]')
        page.wait_for_selector('.error')
        check(f'[{width}] 없는 윤달 안내', '윤달' in page.inner_text('.error'))
        page.uncheck('text=윤달에 태어났어요')
        page.click('button[type=submit]')
        page.wait_for_url('**/result'); page.wait_for_selector('.chart')
        check(f'[{width}] 시간 모름이면 빈 칸 표시', page.locator('.cell.empty').count() == 2)
        if width == 360: page.screenshot(path=f'{OUT}/7_unknown.png', full_page=True)

        # 앱 안에서는 결제 버튼 숨김
        page.goto(BASE + '/result?app=1'); page.wait_for_selector('.chart')
        check(f'[{width}] 앱에서는 결제 안내 숨김', page.locator('text=상세 리포트 보기').count() == 0)
        page.goto(BASE + '/pay'); page.wait_for_url('**/result')
        check(f'[{width}] 앱에서는 결제 화면 접근 차단', True)

        page.goto(BASE + '/info')
        check(f'[{width}] 안내 화면 가로 넘침 없음', no_overflow(page))
        real = [e for e in errors if 'favicon' not in e and '400' not in e]
        check(f'[{width}] 화면 오류 없음', len(real) == 0, '; '.join(real)[:300])
        ctx.close()
    browser.close()

fails = [r for r in results if not r[1]]
print(f'\n총 {len(results)}건 중 통과 {len(results)-len(fails)}건, 실패 {len(fails)}건')
sys.exit(1 if fails else 0)
