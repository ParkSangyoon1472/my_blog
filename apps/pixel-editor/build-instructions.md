# 픽셀 아트 에디터 - Build 단계 지침

이 문서는 Build 서브에이전트 전용 작업 지침이다. 계획은 이미 승인되었으며, 계획 문서는 같은 폴더의 `spec.md`다. **spec.md에 정의된 내용을 그대로 구현**하는 것이 이번 작업의 전부다.

## 범위 (반드시 준수)

- 수정/생성 가능한 파일: `/apps/pixel-editor/index.html`, `/apps/pixel-editor/style.css`, `/apps/pixel-editor/editor.js` 뿐.
- 그 외 블로그 파일(`css/`, `js/`, `templates/`, `posts/`, `scripts/`, `apps/2048/` 등)은 **절대 건드리지 않는다.**
- `spec.md`, `build-instructions.md` 자체도 수정하지 않는다.
- 외부 라이브러리/프레임워크 사용 금지.

## 구현해야 할 것 (spec.md §1~9 요약, 세부사항은 spec.md 원문을 반드시 정독하고 그대로 따를 것)

1. **index.html**
   - `<head>` 최상단에 2048과 동일한 패턴의 인라인 테마 초기화 스크립트(FOUC 방지). 참고를 위해 `apps/2048/index.html`을 읽어서 스크립트를 그대로 재현(파일 링크는 하지 말고 로직만 복제).
   - 제목, 현재 색상 미리보기, 그리드(캔버스 + 오버레이 버튼 256개), 색상 팔레트(16색 스와치 + 커스텀 컬러피커), 도구 버튼(그리기/지우개), 전체 지우기 버튼, 저장 버튼 2개(원본/확대), 조작 안내 텍스트를 배치.
   - `<canvas id="pixel-canvas" width="16" height="16" aria-hidden="true">`.
   - 오버레이 그리드 컨테이너는 `role="grid"` + `aria-label="16x16 픽셀 캔버스"`, 각 버튼은 `role="gridcell"` + 동적 `aria-label`.
   - `style.css`, `editor.js`는 상대경로로 로드.

2. **style.css**
   - spec.md §0, §8에 정리된 블로그/2048 네온 팔레트 값(다크/라이트 모두)을 자체 CSS 변수로 복제 (`apps/2048/style.css`를 참고해서 동일 변수명·동일 값 사용, 링크는 하지 않음).
   - 네온 그리드 배경 패턴 재현.
   - 캔버스에 `image-rendering: pixelated`(+ `-moz-crisp-edges`), 캔버스와 오버레이 그리드 컨테이너에 `touch-action: none`.
   - 반응형 정사각형 그리드: `width: min(90vw, 480px); aspect-ratio: 1/1;`.
   - 팔레트는 `flex-wrap: wrap`, 스와치 선택 시(`aria-pressed="true"`) 네온 시안 테두리+glow 강조.
   - `:focus-visible` 네온 시안 스타일(2048과 동일 톤).
   - `prefers-reduced-motion: reduce` 대응.
   - 세로 스택 레이아웃(제목 → 현재 색상 미리보기 → 그리드 → 팔레트 → 도구/저장 버튼 → 안내문).

3. **editor.js**
   - `pixels` 배열(256, hex 문자열 또는 `null`)을 진짜 상태로 관리, `<canvas>`는 이 배열의 순수 렌더 결과(`drawCell`/`drawAll`)로만 갱신.
   - Pointer Events(`pointerdown`/`pointermove`/`pointerup` 등)로 마우스+터치 통합 드래그 페인팅. 컨테이너 레벨 `pointermove` + `document.elementFromPoint`로 드래그 중 셀 판정(spec.md §3.2 방식 그대로).
   - 그리기/지우개 도구 전환, 전체 지우기(`pixels.fill(null)` + `drawAll()`).
   - 팔레트 스와치 클릭 시 `currentColor` 변경 + `currentTool = 'draw'`로 복귀, 커스텀 컬러피커(`<input type="color">`) 연동, 현재 색상 미리보기 갱신.
   - roving tabindex: 그리드 버튼 중 1개만 `tabindex="0"`, 방향키로 포커스 이동, Enter/Space로 `paintCell` 호출(마우스 클릭과 동일 함수 재사용).
   - PNG 저장 2가지: 원본 16x16(`#pixel-canvas` 그대로 `toBlob`), 확대 512x512(오프스크린 캔버스 + `imageSmoothingEnabled=false` + `drawImage` 확대). 둘 다 `<a download>` 클릭 방식으로 다운로드. 투명 배경 유지(빈 셀은 `fillRect` 생략).

## 완료 조건

- `index.html`을 브라우저에서 직접 열었을 때(별도 빌드 없이) 에디터가 정상 동작해야 한다.
- 마우스 클릭/드래그와 터치 드래그로 도트를 찍고 지울 수 있어야 한다.
- 팔레트에서 색을 고르면 현재 색상이 바뀌고, 커스텀 컬러피커도 동작해야 한다.
- 저장 버튼 클릭 시 실제로 PNG 파일이 다운로드되어야 하며, 투명 배경이 유지되어야 한다.
- 방향키로 그리드 셀 포커스를 이동하고 Enter/Space로 찍을 수 있어야 한다.
- 모바일 뷰포트에서도 레이아웃이 깨지지 않아야 한다.

## 작업 후 보고

구현이 끝나면 만든 파일 목록과 각 파일의 핵심 구현 포인트를 요약해서 보고한다(한국어, 400단어 이내). 이번 단계에서는 브라우저 테스트/검증을 직접 하지 않아도 된다 — 검증은 별도 Review 서브에이전트가 담당한다. 단, 코드 자체에 문법 오류가 없는지는 확인한다.
