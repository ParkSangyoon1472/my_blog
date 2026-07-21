# 2048 게임 - Review 결과

## 검증 일시 / 방법

- 검증 일시: 2026-07-21
- 검증 도구: Browser 도구(preview_start/navigate/computer/read_page/read_console_messages/read_network_requests/resize_window/javascript_tool(디버깅 전용))
- 검증 서버: 저장소 루트를 서빙하는 임시 정적 서버(`python -m http.server 8090`)를 리뷰 목적으로만 임시 실행하여 `http://localhost:8090/apps/2048/index.html`로 접속. 블로그 파일(`scripts/serve.js` 등)은 수정하지 않았고, 검증 종료 후 서버는 종료함.
- 참고: `file:///...index.html`를 프리뷰 도구의 `preview_start(url=...)`로 직접 열었을 때는 도구가 "정적 스냅샷"으로만 렌더링해 CSS/JS가 전혀 실행되지 않았음(네트워크 요청 0건). 이는 프리뷰 도구 자체의 제약이며, 실제 브라우저에서 `file://`로 열면 `<script src>`(비-module) 방식이라 정상 동작할 것으로 판단됨. 정적 서버 경유로 전체 기능을 확실히 검증함.

## 항목별 결과

### 브라우저 동작 확인
- 4방향(Up/Down/Left/Right) 키보드 이동/병합: **통과**. 각 방향을 개별적으로 눌러 타일 이동 방향, 압축, 병합(같은 턴 재병합 방지)이 모두 정확함을 확인(회전/역회전 로직 꼬임 없음).
- 점수/최고점수: **통과**. 병합 시 SCORE 즉시 반영, BEST가 SCORE를 초과할 때만 갱신, `localStorage`(`2048-best-score`)에 저장되어 새로고침 후에도 유지됨을 확인.
- "새 게임" 버튼: **통과**. 클릭 시 보드/점수 초기화, BEST는 유지됨(게임오버 오버레이의 새 게임 버튼도 동일하게 동작 확인).
- 콘솔 에러: **통과**. 데스크톱/모바일 뷰포트, 다크/라이트 테마, 승리/게임오버 시나리오 전 구간에서 콘솔 에러 없음.
- 모바일 뷰포트(375x812): **통과**. 보드가 `min(90vw,420px)`로 화면 안에 들어오고 레이아웃 깨짐 없음. 합성 터치 이벤트(touchstart/touchend)로 스와이프 조작 시 실제 이동/병합이 발생함을 확인.
- 다크/라이트 테마: **통과**. `localStorage.theme`을 `dark`로 설정 후 재로드 시 네온 그리드 배경과 네온 색상 팔레트가 정상 반영됨.

### 코드 리뷰
- 4방향 이동 로직: **통과**. `applyMove`의 transpose/reverse 조합이 up/down/left/right 각각에 대해 올바름을 코드 검토 및 실제 조작으로 교차 확인.
- 유효하지 않은 이동 시 타일 미생성: **통과**(코드상 `result.changed`가 false면 즉시 return, 스폰 없음).
- 게임오버/승리 판정: **통과**. 임시 디버그 훅(`window.__reviewHook`, 검증 후 즉시 제거)으로 보드를 강제 설정해 승리 오버레이("2048 달성! 계속하기…") 및 "계속하기" 클릭 후 이어서 플레이 가능함, 그리고 게임오버 오버레이("게임 오버! 최종 점수 …")가 각각 올바른 조건에서 표시됨을 확인. 승리 후 `continuePlaying` 플래그로 동일 판에서 오버레이가 재노출되지 않음도 확인.
- 접근성 구조: **통과**. `read_page`로 `role=grid`/`row`/`gridcell`, 타일 `aria-label`("n번 타일"/"빈 칸"), `status`(`aria-live="polite"`) 영역 존재 확인. `:focus-visible` 스타일(`style.css` 내 `.btn:focus-visible, .cell:focus-visible`)도 코드상 확인.
- `prefers-reduced-motion: reduce`: **통과**. `style.css` 하단에 pulse/tile-new/tile-merged 애니메이션을 `none`으로 무력화하는 media query 존재.
- 자체 완결성: **통과**. `index.html`/`style.css`/`game.js` 모두 블로그의 `css/`, `js/`, `templates/`를 참조하지 않음(상대경로 `style.css`, `game.js`만 로드).

## 발견한 문제와 수정 내역

- 코드 자체의 버그는 발견되지 않음. 리뷰 과정에서 게임오버/승리 시나리오를 강제 재현하기 위해 `game.js` 끝부분에 `window.__reviewHook` 임시 디버그 훅을 추가했다가, 검증 완료 직후 완전히 제거함(최종 파일은 원본과 동일, 실질적 코드 변경 없음).

## 최종 결론

배포(임베드) 가능. 4방향 이동/병합, 점수·최고점수 persist, 새 게임 리셋, 승리/게임오버 오버레이, 모바일 반응형·스와이프, 접근성 마크업, 다크/라이트 테마, reduced-motion 대응이 모두 spec.md/build-instructions.md 요구사항대로 정상 동작함을 실제 브라우저 조작으로 확인했다. 콘솔 에러 없음. 구조적으로 spec을 재설계해야 할 이슈는 없다.
