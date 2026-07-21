# 2048 게임 - Build 단계 지침

이 문서는 Build 서브에이전트 전용 작업 지침이다. 계획은 이미 승인되었으며, 계획 문서는 같은 폴더의 `spec.md`다. **spec.md에 정의된 내용을 그대로 구현**하는 것이 이번 작업의 전부다.

## 범위 (반드시 준수)

- 수정/생성 가능한 파일: `/apps/2048/index.html`, `/apps/2048/style.css`, `/apps/2048/game.js` 뿐.
- 그 외 블로그 파일(`css/`, `js/`, `templates/`, `posts/`, `index.html`(블로그 루트에 있다면), `scripts/` 등)은 **절대 건드리지 않는다.**
- `spec.md`, `build-instructions.md` 자체도 수정하지 않는다.
- 외부 라이브러리/프레임워크 사용 금지 (CDN 폰트 정도는 필요하면 허용되지만 이번 작업에서는 블로그와 동일한 시스템 폰트 스택을 그대로 쓰면 되므로 불필요).

## 구현해야 할 것 (spec.md §1~6 요약, 세부사항은 spec.md 원문 참조)

1. **index.html**
   - 4x4 보드, 상단 점수판(SCORE / BEST), "새 게임" 버튼, 조작 안내 텍스트("방향키 또는 스와이프로 조작하세요").
   - `role="grid"` / `role="row"` / `role="gridcell"` 구조와 타일 값 `aria-label`.
   - 점수/게임오버/승리 알림용 `aria-live="polite"` 영역(시각적으로 숨김 처리 가능).
   - 최상단에 블로그 header.html과 동일한 패턴의 인라인 테마 초기화 스크립트(FOUC 방지, `localStorage.getItem('theme')` 또는 `prefers-color-scheme` 기반으로 `data-theme` 설정). 참고를 위해 `templates/partials/header.html`을 읽어서 패턴을 그대로 재현할 것(파일 자체는 참조/링크하지 말고 로직만 복제).
   - `style.css`, `game.js`는 상대경로로 로드.

2. **style.css**
   - spec.md §0, §6에 정리된 블로그 네온 팔레트 값(다크/라이트 모두)을 자체 CSS 변수로 복제해서 정의 (블로그 `css/style.css`를 링크하지 않음).
   - 네온 그리드 배경 패턴 재현.
   - 반응형 보드: `min(90vw, 420px)` 류의 relative 크기, `display:grid; grid-template-columns: repeat(4, 1fr)`.
   - 타일 값별 4색(pink/cyan/purple/green) 순환 배색 + 값이 커질수록 glow 강도 증가.
   - 새 타일 등장/병합 시 짧은 glow 펄스 애니메이션, `prefers-reduced-motion: reduce`에서는 애니메이션 축소.
   - 포커스 가시 스타일(`:focus-visible`)을 네온 시안 톤으로.
   - 세로 스택 레이아웃(점수판 → 보드 → 버튼 → 안내문), 모바일/데스크톱 공통.

3. **game.js**
   - 4x4 배열 상태 관리, `moveRowLeft` 핵심 함수를 보드 회전으로 4방향 재사용.
   - 압축 → 병합(같은 턴 재병합 방지) → 압축, 병합값 `score`에 가산.
   - 유효한 이동(보드 변화 발생)일 때만 새 타일 생성(90% `2`, 10% `4`).
   - 게임오버 판정(빈칸 없음 + 병합 가능 쌍 없음), 승리 판정(2048 등장 시 오버레이 표시, "계속하기"로 진행 가능).
   - `ArrowUp/Down/Left/Right` keydown 리스너, 해당 키에 한해 `preventDefault()`.
   - `touchstart`/`touchend` 좌표 비교로 스와이프 판정(임계값 24px 이상만 이동으로 인정).
   - `score`/`best` 갱신, `best`는 `localStorage`(`2048-best-score`) 동기화.
   - "새 게임" 버튼: 보드/점수 리셋(best는 유지).
   - `aria-live` 영역에 점수 변화/게임오버/승리 텍스트 갱신.

## 완료 조건

- `index.html`을 브라우저에서 직접 열었을 때(별도 빌드 없이) 게임이 정상 동작해야 한다.
- 방향키로 타일이 밀리고 합쳐지며 점수가 오르고, `localStorage`에 최고 점수가 저장되어야 한다.
- 모바일 뷰포트에서도 레이아웃이 깨지지 않고 스와이프로 조작 가능해야 한다.

## 작업 후 보고

구현이 끝나면 만든 파일 목록과 각 파일의 핵심 구현 포인트를 요약해서 보고한다(한국어, 400단어 이내). 이번 단계에서는 브라우저 테스트/검증을 직접 하지 않아도 된다 — 검증은 별도 Review 서브에이전트가 담당한다. 단, 코드 자체에 문법 오류가 없는지는 확인한다.
