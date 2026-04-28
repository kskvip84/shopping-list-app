// @ts-check
const { chromium } = require('playwright');
const path = require('path');

const FILE_URL = 'file://' + path.resolve(__dirname, 'shopping-list.html');
const PASS = '✅ PASS';
const FAIL = '❌ FAIL';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, desc) {
  if (condition) {
    results.push({ ok: true,  desc });
    passed++;
  } else {
    results.push({ ok: false, desc });
    failed++;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext();
  const page    = await ctx.newPage();

  await page.addInitScript(() => localStorage.removeItem('shopping'));
  await page.goto(FILE_URL);

  console.log('\n──────────────────────────────');
  console.log(' 테스트: 쇼핑 리스트 앱');
  console.log('──────────────────────────────');

  const emptyIcon = await page.locator('.empty').isVisible();
  assert(emptyIcon, '초기 상태: 빈 장바구니 안내 표시');

  const metaText = await page.locator('#meta').textContent();
  assert(metaText.includes('항목이 없'), '초기 상태: 메타 텍스트 "항목이 없습니다"');

  const clearBtn = await page.locator('#btnClear').isDisabled();
  assert(clearBtn, '초기 상태: "완료 항목 삭제" 버튼 비활성화');

  await page.fill('#input', '사과');
  await page.click('#btnAdd');

  const item0 = await page.locator('.item').count();
  assert(item0 === 1, '추가(버튼): 항목 1개 추가됨');

  const label0 = await page.locator('.item-label').first().textContent();
  assert(label0.trim() === '사과', '추가(버튼): 항목 텍스트 "사과" 정확');

  const inputAfter = await page.inputValue('#input');
  assert(inputAfter === '', '추가 후: 입력창 자동 비워짐');

  await page.fill('#input', '바나나');
  await page.press('#input', 'Enter');

  const item1 = await page.locator('.item').count();
  assert(item1 === 2, '추가(Enter): 항목 2개로 증가');

  const topLabel = await page.locator('.item-label').first().textContent();
  assert(topLabel.trim() === '바나나', '추가 순서: 최신 항목이 맨 위');

  await page.fill('#input', '   ');
  await page.click('#btnAdd');

  const item2 = await page.locator('.item').count();
  assert(item2 === 2, '빈 입력 무시: 공백만 입력 시 항목 추가 안 됨');

  const firstCheckbox = page.locator('.check-box').first();
  await firstCheckbox.click();

  const doneClass = await page.locator('.item').first().getAttribute('class');
  assert(doneClass.includes('done'), '체크: 항목에 "done" 클래스 추가');

  const strikeThrough = await page.locator('.item.done .item-label').first().evaluate(
    el => getComputedStyle(el).textDecoration
  );
  assert(strikeThrough.includes('line-through'), '체크: 취소선 스타일 적용');

  const metaAfterCheck = await page.locator('#meta').textContent();
  assert(metaAfterCheck.includes('완료 1'), '체크: 메타 텍스트 "완료 1개" 반영');

  const clearEnabled = await page.locator('#btnClear').isEnabled();
  assert(clearEnabled, '체크 후: "완료 항목 삭제" 버튼 활성화');

  await firstCheckbox.click();

  const undoneClass = await page.locator('.item').first().getAttribute('class');
  assert(!undoneClass.includes('done'), '체크 해제: "done" 클래스 제거');

  await page.fill('#input', '우유');
  await page.press('#input', 'Enter');

  const beforeDel = await page.locator('.item').count();
  assert(beforeDel === 3, '삭제 준비: 항목 3개 확인');

  await page.locator('.btn-del').first().click();

  const afterDel = await page.locator('.item').count();
  assert(afterDel === 2, '삭제: 항목 1개 줄어 2개');

  const remainingLabels = await page.locator('.item-label').allTextContents();
  assert(!remainingLabels.some(t => t.trim() === '우유'), '삭제: "우유" 항목 제거됨');

  await page.locator('.check-box').first().click();
  await page.locator('.check-box').nth(1).click();

  const doneCount = await page.locator('.item.done').count();
  assert(doneCount === 2, '"완료 항목 삭제" 준비: 2개 체크됨');

  await page.click('#btnClear');

  const afterClear = await page.locator('.item').count();
  assert(afterClear === 0, '"완료 항목 삭제": 모든 완료 항목 삭제됨');

  const emptyAfterClear = await page.locator('.empty').isVisible();
  assert(emptyAfterClear, '"완료 항목 삭제" 후: 빈 장바구니 안내 재표시');

  await page.fill('#input', '오렌지');
  await page.press('#input', 'Enter');
  await page.fill('#input', '딸기');
  await page.press('#input', 'Enter');

  const stored = await page.evaluate(() => localStorage.getItem('shopping'));
  const items  = JSON.parse(stored || '[]');

  const afterReload = items.length;
  assert(afterReload === 2, 'localStorage: 항목 2개 저장됨');

  assert(
    items.some(i => i.text === '오렌지') && items.some(i => i.text === '딸기'),
    'localStorage: "오렌지", "딸기" 모두 저장됨'
  );

  const ctx2  = await browser.newContext();
  const page2 = await ctx2.newPage();

  await page2.addInitScript((data) => {
    localStorage.setItem('shopping', data);
  }, stored);
  await page2.goto(FILE_URL);

  const reloadCount = await page2.locator('.item').count();
  assert(reloadCount === 2, 'localStorage: 새 탭 로드 후 항목 2개 복원');

  const reloadLabels = await page2.locator('.item-label').allTextContents();
  assert(
    reloadLabels.some(t => t.trim() === '오렌지') && reloadLabels.some(t => t.trim() === '딸기'),
    'localStorage: "오렌지", "딸기" 모두 복원됨'
  );
  await ctx2.close();

  console.log('');
  results.forEach(r => {
    console.log(`  ${r.ok ? PASS : FAIL}  ${r.desc}`);
  });

  console.log('\n──────────────────────────────');
  console.log(` 결과: ${passed + failed}개 중 ${passed}개 통과, ${failed}개 실패`);
  console.log('──────────────────────────────\n');

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();