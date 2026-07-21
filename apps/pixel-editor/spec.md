# 픽셀 아트 에디터 - 구현 계획 (Plan)

> 이 문서는 계획 단계 산출물이다. 실제 코드(index.html, editor.js 등)는 아직 작성하지 않는다.

## 0. 참고: 기존 앱(2048)·블로그 디자인 시스템 조사 결과

`apps/2048/spec.md`, `apps/2048/index.html`, `apps/2048/style.css`, `css/style.css`, `templates/partials/header.html`을 확인한 결과:

- **자체 완결 원칙**: `apps/2048/`은 `css/style.css`를 직접 참조(link/import)하지 않고, 블로그 디자인 시스템의 CSS 변수 값을 **동일한 변수명·동일한 값으로 복제**해 자체 `style.css` 안에 정의했다. `apps/pixel-editor/`도 동일한 방식을 따른다(파일 의존성 없음, 값만 동일).
- **테마 전환 패턴**: `<head>` 최상단 인라인 스크립트에서 `localStorage.getItem('theme')` → 없으면 `prefers-color-scheme: dark` 판정 → `document.documentElement.setAttribute('data-theme', theme)`. FOUC 방지를 위해 `<link rel="stylesheet">`보다 먼저 실행. 2048과 완전히 동일한 스크립트를 그대로 재사용.
- **다크(기본) 팔레트**: `--color-bg:#050507`, `--color-bg-elevated:#0d0d14`, `--color-text:#e8e8ff`, `--color-text-muted:#8d8db0`, `--color-neon-pink:#ff2bd6`, `--color-neon-cyan:#00fff2`, `--color-neon-purple:#b026ff`, `--color-neon-green:#39ff88`, `--color-border: rgba(0,255,242,0.35)`, `--glow-pink/cyan/purple` (text-shadow/box-shadow용), `--grid-line: rgba(0,255,242,0.06)`.
- **라이트 팔레트**: `--color-bg:#faf8ff`, `--color-bg-elevated:#f1ecff`, `--color-text:#1a1a2e`, `--color-text-muted:#5c5c7a`, 네온 색상은 저명도 고채도 톤(`#d6009c`, `#0091b3`, `#7a1fd6`, `#0a8f3c`)으로 대비 확보, glow는 전부 `none`, `--grid-line: transparent`.
- **폰트**: `--font-body`(시스템 산세리프 + 한글 폰트 스택), `--font-mono`(숫자/코드용 모노스페이스).
- **공통 톤**: `--radius: 10px`, `--space-1~4` 간격 스케일, 배경 42px(모바일 28px) 네온 그리드 패턴, 카드류는 `--color-bg-elevated` 배경 + `--color-border` + hover 시 glow, 버튼(`.btn`)은 테두리+glow 방식, `:focus-visible`은 `--color-neon-cyan` 아웃라인 + glow.
- 2048은 DOM 기반(`div.cell` + `role="grid"/"gridcell"`) 보드를 택했는데, 이는 2048에 래스터 내보내기 요구사항이 없었기 때문이다. 픽셀 에디터는 PNG 저장이 핵심 요구사항이므로 아래 2절에서 별도로 렌더링 방식을 검토한다.

## 1. 파일 구조

```
/apps/pixel-editor/
  index.html   # 페이지 마크업 (그리드+오버레이, 팔레트, 도구 버튼, 저장 버튼, 안내문)
  style.css    # 자체 CSS 변수 세트 포함, 블로그/2048과 무관하게 완결
  editor.js     # 그리기 로직, 팔레트, 도구, PNG 내보내기 전체 (바닐라 JS)
  spec.md      # 본 계획 문서
```

- 세 파일 모두 `/apps/pixel-editor/` 안에서만 참조 관계를 가진다. 블로그의 `css/`, `js/`, `templates/`, `posts/`, `apps/2048/`은 일절 수정/참조하지 않는다.
- `index.html`은 독립적으로 브라우저에서 바로 열리거나 정적 서버로 서빙 가능해야 하며, blog의 `scripts/build.js` 파이프라인에 포함되지 않는다.

## 2. 16x16 격자 렌더링 방식 — DOM vs Canvas 비교 및 선택

| | DOM (div/button 256개) | `<canvas>` |
|---|---|---|
| PNG 저장 | 불가능 — 셀 배경색을 순회해 어차피 canvas로 재변환해야 함(이중 작업) | `canvas.toBlob()`으로 직접 변환, 확대 저장도 `drawImage` 스케일링으로 간단 |
| 키보드 접근성 | 각 셀이 네이티브 포커스 가능(`<button>`), 별도 작업 불필요 | 셀 단위 네이티브 포커스가 없어 roving tabindex 등 수동 구현 필요 |
| 성능 | 256개면 문제 없음 | 문제 없음(오히려 더 가벼움) |
| 구현 복잡도 | 클릭/터치 이벤트 위임 간단, CSS로 네온 hover/focus 스타일 재사용 쉬움 | 좌표→셀 인덱스 수동 계산 필요, 포커스 링을 직접 그리거나 오버레이 필요 |

**결론(하이브리드 채택)**: 상태(진짜 데이터)는 `pixels` 배열(길이 256, 각 원소는 hex 색상 문자열 또는 `null`=투명)로 관리하고, 이를 **두 개의 레이어**로 렌더링한다.

1. **시각적 렌더 + 내보내기 레이어**: `<canvas id="pixel-canvas" width="16" height="16">` — 캔버스의 실제 픽셀 버퍼 해상도를 16x16으로 고정하고 셀마다 `fillRect(x, y, 1, 1)`로 1픽셀씩 그린다. CSS로 `width/height`를 크게 확대하고 `image-rendering: pixelated`(+`-moz-crisp-edges`)를 적용해 도트가 뭉개지지 않게 표시한다. 저장 시 이 캔버스(또는 이를 확대 복사한 오프스크린 캔버스)를 그대로 `toBlob`한다.
2. **입력(마우스/터치/키보드) 레이어**: 캔버스 위에 `position: absolute`로 겹치는 `display: grid` 컨테이너에 투명 `<button class="cell-btn" role="gridcell">` 256개를 배치한다. 클릭/포인터 이벤트, 키보드 포커스·Enter/Space 입력을 전부 이 버튼들이 받아서 `pixels` 배열을 갱신하고, 갱신 후 캔버스를 다시 그린다(버튼 자체는 투명 배경 + hover/focus 시에만 테두리/glow 표시).

이 방식은 캔버스의 내보내기 이점과 DOM 버튼의 네이티브 키보드 접근성을 모두 취하면서, 상태를 이중 관리하지 않는다(캔버스는 `pixels` 배열의 순수 렌더 결과일 뿐).

## 3. 그리기 로직 (editor.js)

### 3.1 상태
- `pixels`: `Array(256).fill(null)` (인덱스 = `row * 16 + col`, 값 = hex 색상 문자열 또는 `null` = 투명/빈 칸).
- `currentColor`: 현재 선택된 색상(기본값 `--color-neon-cyan` 값 등 팔레트 첫 항목).
- `currentTool`: `'draw' | 'erase'`.
- `isPointerDown`: 드래그 중 여부.

### 3.2 클릭/드래그로 도트 찍기 (Pointer Events로 마우스+터치 통합)
- 각 `.cell-btn`에 `pointerdown` → `isPointerDown = true` + `paintCell(index)` 호출 + `event.target.setPointerCapture(event.pointerId)`(같은 버튼이 계속 포인터 이벤트를 받도록).
- 포인터 캡처만으로는 다른 버튼 위로 이동 시 `pointerenter`가 캡처한 요소로만 전달되므로, 컨테이너(오버레이 grid) 레벨에서 `pointermove`를 리스닝하고 `document.elementFromPoint(x, y)`로 실제 아래 있는 `.cell-btn`을 찾아 `paintCell`을 호출하는 방식을 사용(캡처를 컨테이너가 아닌 개별 버튼에 걸지 않거나, 혹은 애초에 포인터 캡처를 하지 않고 컨테이너에서 `pointermove` + `elementFromPoint`만으로 처리 — 후자가 더 단순하므로 채택).
- `pointerup`/`pointercancel`/`pointerleave`(window 레벨) → `isPointerDown = false`.
- `paintCell(index)`: `isPointerDown`이 true이거나 최초 클릭이면 `pixels[index] = currentTool === 'erase' ? null : currentColor`로 갱신 후 해당 셀만 다시 그리는 `drawCell(index)` 호출(전체 재렌더 대신 부분 갱신으로 성능 확보).

### 3.3 지우개 도구
- 툴바에 "그리기"/"지우개" 토글 버튼 2개(또는 팔레트 하단에 지우개 아이콘 버튼 1개, 클릭 시 `currentTool = 'erase'`로 전환하고 팔레트 색상 선택 UI는 비활성 표시하지 않고 유지 — 다시 색상을 클릭하면 자동으로 `currentTool = 'draw'`로 복귀).
- 지우개 선택 시 시각적으로 현재 도구 표시(버튼에 active 클래스, 네온 outline).

### 3.4 전체 지우기(Clear)
- "전체 지우기" 버튼 클릭 시 `pixels.fill(null)` 후 캔버스 전체 재렌더(`drawAll()`), 확인 없이 즉시 실행(되돌리기 기능은 이번 범위에 포함하지 않음 — 필요 시 추후 개선 항목으로 명시).

## 4. 색상 팔레트 UI

- 기본 팔레트(16색, 버튼 그리드로 배치, 각 버튼은 `<button class="swatch" style="background:{hex}" aria-label="{색상 이름}">`):
  1. 투명(지우개) — 체크무늬 배경으로 표시
  2. `#000000` 검정
  3. `#ffffff` 흰색
  4. `#8d8db0` 회색 (블로그 `--color-text-muted` 값 재사용)
  5. `#ff2bd6` 네온 핑크
  6. `#00fff2` 네온 시안
  7. `#b026ff` 네온 퍼플
  8. `#39ff88` 네온 그린
  9. `#ff4d4d` 빨강
  10. `#ff9d2b` 주황
  11. `#ffe94d` 노랑
  12. `#4d7dff` 파랑
  13. `#6b4423` 갈색
  14. `#1a1a2e` 남색(블로그 라이트 테마 텍스트색 재사용)
  15. `#5c5c7a` 연회색(블로그 라이트 테마 muted색 재사용)
  16. `#d6009c` 진분홍(블로그 라이트 테마 핑크 계열)
- **커스텀 색상**: 팔레트 끝에 `<input type="color" id="custom-color">` 배치. 값 변경 시 해당 색을 팔레트 맨 앞(또는 별도 "현재 색상" 슬롯)에 반영하고 `currentColor`로 설정.
- **현재 선택된 색상 표시**: 팔레트 옆에 `.current-color-preview` 박스(정사각형, 배경색 = `currentColor`, 테두리는 `--color-border`, 텍스트 라벨 "현재 색상")를 두어 항상 확인 가능하게 함.
- 팔레트 스와치 선택 시 `aria-pressed="true"`로 현재 선택 표시, 나머지는 `false`.

## 5. PNG 저장 기능

- 저장 버튼 2개 제공(둘 다 `canvas.toBlob('image/png')` 기반):
  1. **"원본 크기로 저장" (16x16)**: 메인 캔버스(`#pixel-canvas`, 실제 버퍼 16x16)를 그대로 `toBlob`.
  2. **"확대해서 저장" (512x512, 기본 추천)**: 오프스크린 `<canvas>`(DOM에 붙이지 않음)를 새로 생성, `width=512, height=512` 설정 후 `ctx.imageSmoothingEnabled = false`로 안티앨리어싱을 끄고 `ctx.drawImage(sourceCanvas, 0, 0, 16, 16, 0, 0, 512, 512)`로 nearest-neighbor 방식 확대(캔버스 API는 `imageSmoothingEnabled=false`일 때 정수배 확대에서 자동으로 nearest-neighbor 처리). 512는 32배 확대(16×32=512)로 도트가 선명하게 유지됨.
- 공통 다운로드 로직: `canvas.toBlob(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'pixel-art-16x16.png' (또는 'pixel-art-512x512.png'); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }, 'image/png')`.
- 투명 배경 처리: `pixels` 값이 `null`인 셀은 `fillRect`를 호출하지 않고(캔버스 기본값이 투명) 그대로 두어, 저장된 PNG에서도 투명 배경이 유지되도록 한다(캔버스를 미리 불투명 배경색으로 채우지 않음).

## 6. 모바일 대응

- **터치 드래그**: 3.2절의 Pointer Events 기반 로직이 마우스/터치/펜을 통합 처리하므로 별도 `touchstart/touchmove` 리스너 불필요.
- **스크롤 충돌 방지**: 캔버스와 오버레이 grid 컨테이너 양쪽에 `touch-action: none` CSS 적용(드래그로 그리는 동안 페이지가 스크롤되지 않도록). 팔레트·버튼 영역은 `touch-action: auto` 유지.
- **반응형 레이아웃**: 그리드 컨테이너 크기를 `min(90vw, 480px)`(2048의 `width: min(90vw, 420px)` 패턴 재사용, 정사각형이므로 `aspect-ratio: 1/1`)로 지정. 팔레트는 `display: flex; flex-wrap: wrap;`로 좁은 화면에서 자동 줄바꿈. 저장/도구 버튼도 `flex-wrap: wrap; justify-content: center;`. 세로 스택 순서: 제목 → 현재 색상 미리보기 → 그리드 → 팔레트 → 도구/저장 버튼 → 안내문(2048과 동일한 세로 스택 패턴, 데스크톱에서도 동일 구조를 중앙 정렬해 재사용).
- 480px 이하 미디어 쿼리에서 제목 폰트 축소, 배경 그리드 패턴 28px로 축소(2048과 동일 값).

## 7. 접근성

- 그리드 오버레이 컨테이너에 `role="grid"` + `aria-label="16x16 픽셀 캔버스"`, 각 행 개념은 CSS grid로만 표현하고(2048처럼 `role="row"` DOM 래퍼를 추가로 둘 수도 있으나 256개 버튼을 16행 `role="row"` div로 감싸는 구조도 고려), 각 버튼은 `role="gridcell"` + `aria-label="{row+1}행 {col+1}열, 색상: {현재 색상 이름 또는 '비어 있음'}"`(색 변경 시 동적으로 갱신).
- **키보드 조작**: 
  - `Tab`으로 팔레트 스와치 사이 이동(각 스와치가 네이티브 `<button>`이므로 기본 지원), `Enter/Space`로 색상 선택.
  - 그리드 진입 시 roving tabindex 적용: 그리드 버튼 256개 중 1개만 `tabindex="0"`(나머지 `-1`), 포커스된 셀에서 방향키(`ArrowUp/Down/Left/Right`)로 인접 셀로 포커스 이동, `Enter/Space`로 현재 셀에 `currentColor` 또는 지우개 적용(3.2절 `paintCell`과 동일 함수 재사용).
  - 캔버스(`<canvas>`) 자체는 `aria-hidden="true"`(순수 시각 렌더용, 상호작용은 오버레이 버튼이 전담).
- **색상 텍스트 라벨**: 팔레트 각 스와치에 `aria-label`로 한글 색상명(예: "네온 핑크", "투명(지우개)") 제공, 마우스 사용자를 위한 `title` 속성도 동일하게 부여.
- `:focus-visible`은 2048과 동일하게 `--color-neon-cyan` 아웃라인 + `var(--glow-cyan)`로 명시적 스타일링.
- `prefers-reduced-motion: reduce`에서 셀 페인트 시 애니메이션(있다면 짧은 pop 효과)을 비활성화.

## 8. 기존 블로그/2048과 통일된 비주얼 스타일

- `/apps/pixel-editor/style.css` 최상단에 2048과 **완전히 동일한 이름·동일한 값**의 CSS 변수 세트를 자체 정의: `--color-bg`, `--color-bg-elevated`, `--color-text`, `--color-text-muted`, `--color-neon-pink/cyan/purple/green`, `--color-border`, `--glow-pink/cyan/purple`, `--grid-line`, `--font-body`, `--font-mono`, `--space-1~4`, `--radius: 10px` (라이트 테마 오버라이드 포함). 값은 2048의 `apps/2048/style.css`에서 그대로 가져오되, 파일 링크/의존 없이 복제.
- 다크/라이트: 2048과 동일한 인라인 FOUC 방지 스크립트를 `<head>`에 그대로 재사용(`localStorage.getItem('theme')` → 없으면 `prefers-color-scheme`).
- 배경에 동일한 네온 그리드 패턴(42px/모바일 28px, `--grid-line` 사용).
- 제목(`h1`)은 `--color-neon-pink` + `var(--glow-pink)` 텍스트 섀도우(2048 `.game-title`과 동일 패턴).
- 캔버스/팔레트/버튼 컨테이너는 2048의 `.board`/`.score-box`와 동일하게 `background-color: var(--color-bg-elevated)`, `border: 1px solid var(--color-border)`, `border-radius: var(--radius)` 적용.
- 저장 버튼은 2048의 `.btn.btn-primary`(시안 톤) 스타일 재사용, 도구 버튼(그리기/지우개)은 활성 시 `.btn-secondary`(퍼플 톤) 톤을 재사용해 선택 상태를 표시.
- 팔레트 스와치 선택(`aria-pressed="true"`) 시 테두리를 `--color-neon-cyan` + `var(--glow-cyan)`로 강조(2048 카드 hover glow 패턴 참고).
- 폰트는 `--font-body` 스택 그대로 사용, 좌표/색상 코드 표기(있다면)는 `--font-mono` 사용.

## 9. 블로그 메인 페이지 임베드 메모 (이번 단계는 미작업, 메모만)

- **카드 제목**: "픽셀 아트 에디터"
- **한 줄 설명**: "16x16 격자에 도트를 찍어 그림을 그리고 PNG로 저장하는 미니 에디터"
- **미리보기 방식**: `iframe` 권장. 2048과 동일한 이유 — `/apps/pixel-editor/`가 완전히 자체 완결된 CSS/JS를 가지므로 블로그 메인 페이지의 전역 스타일과 충돌 없이 격리해서 보여주기 좋음. `templates/index.html`의 기존 `.app-card` 구조를 그대로 따라 `<iframe src="/apps/pixel-editor/index.html" loading="lazy" style="...">` 형태로 삽입 예상(단, 미리보기 iframe은 `pointer-events: none`이므로 카드 자체는 클릭 시 실제 앱 페이지로 이동하는 링크로 감싸는 기존 `.app-card` 패턴을 그대로 재사용).
- 실제 `templates/index.html`, `css/style.css` 등 블로그 파일 수정 및 카드 삽입은 이번 계획 단계에 포함하지 않으며, 별도 작업 단계에서 진행한다.
