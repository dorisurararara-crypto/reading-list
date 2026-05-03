# Reading List — Chrome Extension (v0.1.1)

PWA의 진입 마찰을 해결한 1클릭 저장 확장.

## 설치 (Developer mode)
1. 이 repo clone 또는 `extension/` 폴더 다운로드
2. Chrome 주소창에 `chrome://extensions` 입력
3. 우측 상단 "개발자 모드" 켬
4. "압축해제된 확장 프로그램을 로드합니다" → `extension/` 폴더 선택
5. 툴바에 ⊕ Reading List 아이콘 등장

## 사용
- **툴바 클릭** = 현재 탭 즉시 저장 (popup 없음, 1클릭)
- **단축키**: `Cmd+Shift+S` (Mac) / `Ctrl+Shift+S` (Win) — 현재 탭 저장
- **단축키**: `Cmd+Shift+L` (Mac) / `Ctrl+Shift+L` (Win) — 라이브러리 열기
- **우클릭 메뉴**:
  - 페이지에서: "이 페이지를 Reading List에 저장"
  - 링크에서: "이 링크를 Reading List에 저장"
- **라이브러리**: `chrome://extensions` → Reading List → "옵션" 또는 단축키

## 데이터
- 정본은 `chrome.storage.local` (이 확장 안에만 저장, 동기화 X)
- PWA(웹 버전)에서 백업한 JSON 파일은 옵션 페이지 "복원" 버튼으로 가져올 수 있음
- 양방향 자동 sync는 의도적으로 미지원 (서버·계정 없는 정책)

## 권한
- `storage` — 저장 데이터
- `contextMenus` — 우클릭 메뉴
- `activeTab` — 현재 탭 URL/제목 읽기
- `tabs` — 단축키로 탭 정보 읽기
- `notifications` — 저장 결과 토스트

호스트 권한 0개. 어떤 사이트도 차단하지 않음.

## 개발
```bash
cd extension/
# 수정 → chrome://extensions → Reading List → 새로고침 ↻
```
