# 2048 게임 - 구현 계획 (Plan)

> 이 문서는 계획 단계 산출물이다. 실제 코드(index.html, game.js 등)는 아직 작성하지 않는다.

## 0. 참고: 기존 블로그 디자인 시스템 조사 결과

`css/style.css`, `templates/index.html`, `templates/partials/header.html`, `footer.html`을 확인한 결과:

- **테마 전환 방식**: `<html>`의 `data-theme` 속성("dark"/"light")을 `localStorage.getItem('theme')` 값 또는 `prefers-color-scheme`으로 초기 설정. 최상단 인라인 스크립트에서 FOUC 방지.
- **다크(기본) 팔레트**: `--color-bg:#050507`, `--color-bg-elevated:#0d0d14`, `--color-text:#e8e8ff`, `--color-text-muted:#8d8db0`, 네온 포인트 컬러 `--color-neon-pink:#ff2bd6`, `--color-neon-cyan:#00fff2`, `--color-neon-purple:#b026ff`, `--color-neon-green:#39ff88`. 텍스트/보더에 `--glow-*` (text-shadow/box-shadow glow) 적용.
- **라이트 팔레트**: 배경 `#faf8ff`/`#f1ecff`, 텍스트 `#1a1a2e`, 네온 컬러는 채도를 유지한 채 명도를 낮춘 톤(`#d6009c`, `#0091b3`, `#7a1fd6`, `#0a8f3c`)으로 대비 확보, glow는 전부 `none`.
- **폰트**: `--font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif;` / `--font-mono: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace;`
- **배경 그리드 패턴**: `--grid-line`을 이용한 42px(모바일 28px) 격자 배경 (사이버펑크 톤의 핵심 요소).
- **기타 톤**: 카드(`.post-card`)는 `--color-bg-elevated` 배경 + 좌측 네온 보더 + hover 시 glow, 보더 radius `10px`, 버튼류(`.theme-toggle`)는 원형 + glow.

CLAUDE.md 규칙상 `/apps/2048/`은 자체 완결(self-contained)이어야 하므로 `css/style.css`를 직접 참조(import/link)하지 않는다. 대신 **위 변수 값을 그대로 복제한 자체 CSS 변수 세트**를 `/apps/2048/style.css` 안에 정의하여 시각적 일관성을 유지한다 (값의 출처만 동일, 파일 의존성은 없음).

## 1. 파일 구조

```
/apps/2048/
  index.html   # 게임 페이지 마크업 (보드, 점수판, 버튼, 안내 텍스트)
  style.css    # 게임 전용 스타일 (자체 CSS 변수 포함, 블로그와 무관하게 완결)
  game.js      # 게임 로직 전체 (바닐라 JS, 외부 라이브러리 없음)
  spec.md      # 본 계획 문서
```

- 세 파일 모두 `/apps/2048/` 안에서만 참조 관계를 가지며, 블로그의 `css/`, `js/`, `templates/`, `posts/`는 일절 수정/참조하지 않는다.
- `index.html`은 독립적으로 브라우저에서 바로 열리거나 정적 서버로 서빙 가능해야 한다 (blog의 build.js 파이프라인에 포함되지 않음).

## 2. 게임 로직 설계 (game.js)

### 2.1 데이터 구조
- 4x4 보드를 `number[4][4]` 배열로 표현. `0`은 빈 칸, 그 외 값은 타일 숫자(2, 4, 8, ...).
- 상태: `board`, `score`(현재 점수), `best`(최고 점수, localStorage 동기화), `isGameOver`, `hasWon`(2048 달성 여부, 달성 후에도 계속 진행 가능하도록 별도 플래그로 관리).

### 2.2 입력 처리
- `window.addEventListener('keydown', ...)`으로 `ArrowUp/Down/Left/Right` 캡처.
- 게임 보드가 페이지의 유일한 인터랙션 대상이므로 전역 키 리스너 사용, 스크롤 방지를 위해 해당 키에 한해 `event.preventDefault()`.
- 게임오버 상태에서는 방향키 입력 무시(또는 "다시 시작" 버튼으로만 리셋 가능).

### 2.3 이동/병합 알고리즘
- 4방향 로직을 중복 구현하지 않기 위해 "왼쪽으로 밀기" 한 가지 핵심 함수(`moveRowLeft`)만 구현하고, 다른 방향은 보드를 회전(rotate 90도)시킨 뒤 동일 함수를 적용, 다시 역회전하는 방식으로 처리.
  1. 각 행에서 0을 제거하고 왼쪽으로 압축(compress).
  2. 인접한 두 값이 같으면 1회만 병합(왼쪽 값 2배, 오른쪽 값 제거) — 병합된 타일은 같은 턴에 재병합되지 않도록 인덱스 스킵 처리.
  3. 다시 압축.
  4. 병합 발생 시 해당 값을 `score`에 가산.
- 이동 전/후 보드를 비교하여 실제 변화가 있었을 때만 "유효한 이동"으로 간주(변화 없으면 새 타일을 생성하지 않음 — 2048 규칙 핵심).

### 2.4 랜덤 타일 생성
- 유효한 이동 직후, 빈 칸(`0`) 좌표 목록을 수집해 무작위로 하나 선택.
- 90% 확률로 `2`, 10% 확률로 `4` 배치.
- 게임 시작 시 초기 타일 2개를 동일한 규칙으로 배치.

### 2.5 게임오버 / 승리 조건
- **게임오버**: 빈 칸이 없고(`0`이 board에 없음), 동시에 4방향 어느 쪽으로도 병합 가능한 인접 쌍이 없을 때. 매 이동 후 검사.
- **승리**: 보드에 `2048` 값이 처음 등장하는 순간. 승리 오버레이(예: "2048 달성!" + "계속하기" / "새 게임" 버튼)를 표시하되, "계속하기"를 선택하면 `hasWon` 플래그만 세우고 게임을 계속 진행할 수 있게 한다(2048 원작 동작 방식).

## 3. 점수판 UI 설계

- 상단에 두 개의 점수 박스: **SCORE**(현재 점수), **BEST**(최고 점수).
- `score`는 매 병합마다 갱신, 병합값만큼 즉시 반영.
- `best`는 `localStorage.getItem('2048-best-score')`로 로드하고, 게임 중 `score > best`가 되는 순간마다 갱신 + `localStorage.setItem`으로 저장.
- 점수 갱신 시 짧은 "+n" 팝업 애니메이션(선택적 디테일, CSS로 구현) 고려.
- "새 게임" 버튼: 클릭 시 board 초기화, score를 0으로 리셋(단 best는 유지).

## 4. 모바일 대응

- **터치 스와이프**: `touchstart`에서 시작 좌표 기록, `touchend`에서 종료 좌표와 비교. `deltaX`, `deltaY` 중 절대값이 더 큰 축을 이동 방향으로 판정하고, 최소 스와이프 거리(예: 24px) 임계값 미만은 무시(탭과 구분). `touchmove` 시 보드 영역 내 스크롤을 막기 위해 `touch-action: none` 또는 `preventDefault()` 적용.
- **반응형 레이아웃**: 보드 크기를 고정 px 대신 `min(90vw, 420px)` 같은 relative 단위로 지정, 타일 크기는 보드 크기에서 gap을 뺀 값을 4등분하여 JS 또는 CSS `grid` (`display:grid; grid-template-columns: repeat(4, 1fr)`)로 자동 계산. 폰트 크기도 타일 크기에 비례하도록 `clamp()` 사용.
- 세로 화면(모바일 기본)에서 점수판 - 보드 - 버튼 - 안내문 순서의 세로 스택 레이아웃, 가로 폭이 넓은 화면(데스크톱)에서도 동일 구조를 중앙 정렬해 재사용(별도 데스크톱 전용 레이아웃 불필요).

## 5. 접근성 고려사항

- 보드 컨테이너에 `role="grid"`, 각 행에 `role="row"`, 각 칸에 `role="gridcell"` 부여하고 타일 값은 `aria-label`(예: "4번 타일" 또는 빈 칸은 "빈 칸")로 노출.
- 점수 변경, 게임오버, 승리 메시지는 `aria-live="polite"` 영역(스크린리더 전용, 시각적으로는 숨김 `sr-only` 처리 가능)에 텍스트로 갱신하여 스크린리더 사용자에게 알림.
- "새 게임" 등 버튼은 실제 `<button>` 엘리먼트 사용, `:focus-visible` 아웃라인을 블로그의 네온 glow 톤(`--color-neon-cyan` 계열)으로 명시적으로 스타일링해 키보드 포커스 가시성 확보.
- 키보드 조작(방향키)이 기본 인터랙션이므로 별도 tabindex 트랩 없이 페이지 전역에서 동작하되, 안내 텍스트("방향키 또는 스와이프로 조작하세요")를 화면에 노출.
- 색상 대비: 타일 배경/텍스트 조합을 다크·라이트 각각에서 WCAG AA 수준(4.5:1 이상, 큰 숫자 텍스트는 3:1 이상) 기준으로 점검 예정 — 특히 저채도 타일(2, 4)의 텍스트 색상.
- `prefers-reduced-motion: reduce` 사용자를 위해 타일 이동/병합 애니메이션과 glow 펄스 효과를 축소하는 media query 분기 고려.

## 6. 기존 블로그와 어울리는 비주얼 스타일

- `/apps/2048/style.css` 최상단에 블로그와 동일한 값의 CSS 변수 세트를 자체 정의(`--color-bg`, `--color-bg-elevated`, `--color-text`, `--color-neon-pink/cyan/purple/green`, `--glow-*`, `--font-body`, `--font-mono`, `--radius` 등). 값은 동일하되 블로그 CSS 파일에 대한 링크/의존은 없음(복제 방식).
- 다크/라이트 모두 지원: 게임 페이지 자체에 최상단 인라인 스크립트(블로그 header.html과 동일 패턴)를 두어 `localStorage.getItem('theme')` 또는 `prefers-color-scheme`을 읽어 `data-theme` 속성을 설정 — 추후 iframe 임베드 시 부모 페이지와 별개로 자체 판단하되 같은 로직/같은 localStorage 키를 사용하므로 대체로 일치된 테마로 보이게 됨.
- 배경에 블로그와 동일한 네온 그리드 패턴(`--grid-line` 격자) 재현.
- 타일 색상: 값의 크기(2/4/8/... /2048)에 따라 4가지 네온 컬러(pink/cyan/purple/green)를 순환 또는 그라데이션으로 배정하고, 값이 커질수록 glow 강도를 높여 "레벨업"이 시각적으로 드러나게 함. 카드(`.post-card`)의 hover glow 패턴을 참고해 새 타일 등장/병합 시 짧은 glow 펄스 애니메이션 적용.
- 버튼/보드 컨테이너는 블로그의 `--radius:10px`, `border:1px solid var(--color-border)` 스타일을 그대로 재사용해 톤을 맞춤.
- 폰트는 블로그의 `--font-body` 스택을 그대로 사용(숫자 표시에는 가독성을 위해 `--font-mono` 사용도 고려).

## 7. 블로그 메인 페이지 임베드 메모 (다음 단계 예정, 이번 단계는 미작업)

- **카드 제목**: "2048"
- **한 줄 설명**: "방향키로 숫자 타일을 밀어서 합치는 퍼즐 게임"
- **미리보기 방식**: `iframe` 권장. 이유: `/apps/2048/`이 완전히 자체 완결된 CSS/JS를 갖기 때문에 블로그 메인 페이지의 전역 스타일과 충돌 없이 격리해서 보여주기 좋음. `<iframe src="/apps/2048/index.html" loading="lazy" style="aspect-ratio: 1/1.1; width:100%; border:1px solid var(--color-border); border-radius:var(--radius);">` 형태 예상.
- 실제 `templates/index.html`, `css/style.css` 등 블로그 파일 수정 및 카드 삽입은 이번 계획 단계에 포함하지 않으며, 별도 작업 단계에서 진행한다.
