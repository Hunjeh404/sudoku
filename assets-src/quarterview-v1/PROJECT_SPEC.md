# 올림포스의 작은 정원 — 온라인 스도쿠 게임 기획·개발 명세서
버전 1.1 / 2026-10-15 / 클로드 개발 인계용

## 0. 이 문서의 사용법과 확정 범위
이 문서를 구현 기준으로 사용하라. 단순 목업이 아니라 실제 계정·저장·집 방문·방명록까지 동작하는 게임을 목표로 한다. 게임 코드·배포·외부 서비스 생성은 아직 수행하지 않았다. 쿼터뷰 배경 2장·가구 20종의 정적 PNG는 생성·검수하여 이 패키지에 포함했다. GitHub 업로드는 연결 앱 권한 오류로 아직 완료되지 않았다.

사용자 확정 요구:
- 초등학교 3학년 딸과 성인 아내에게 선물할 그리스신화 스도쿠 게임.
- 기존 greek-myth-map 저장소의 일러스트와 데이터를 재사용.
- 재미있는 수집·집 꾸미기, 터치할 때 반응하는 꾸미기 아이템.
- 다른 사용자의 집 방문과 간단한 방명록.
- 최종 결정은 온라인 게임. 앞서 논의한 로컬 전용·파일 교환 설계는 폐기.
- 코딩은 Claude가 담당.
- 꾸미기 시점은 쿼터뷰. 신규 일러스트는 이 대화에서 직접 생성하여 전달.

이하 제목, 기술 구성, 가격·보상 수치, 콘텐츠 분량은 구현 가능한 권장 기본값이다. 사용자 확정 발언으로 취급하지 말고 설정 데이터로 분리한다. 사용자 요청 없이 기존 신화 사이트를 수정하거나 대체하지 않는다. 새 게임은 별도 프로젝트에서 만든다.

## 1. 한 문장 기획과 핵심 재미
“스도쿠로 별빛을 모아 작은 집과 정원을 꾸미고, 신화 속 보물을 가지고 놀며 가족의 집에 놀러 가는 게임.”

순환: 원하는 보상 선택 → 스도쿠 → 별빛·해금 → 구매·배치 → 물건을 눌러 반응 발견 → 친구 초대·집 방문 → 다음 꾸미기 목표.
스도쿠 실력 향상과 공간 성장 둘 다 보이게 한다. 초등용 학습 과제처럼 강제하지 않는다. 성인에게도 읽기 쉬운 숫자와 후보 메모, 차분한 연출을 제공한다.

첫 10분:
1. 이름·프로필·안내 친구 선택.
2. 빈 집 대신 기본 가구가 있는 집과 정원을 받음.
3. 스도쿠 경험 선택. 4×4 짧은 안내 또는 9×9 바로 시작 가능.
4. 첫 완료 때 장식 3종 중 1개 선택, 즉시 배치.
5. 물건 터치로 반응 체험.
6. 가족 연결이 되어 있다면 상대 집 방문. 없으면 명확히 표시한 견본 집 방문.
7. 다음에 얻고 싶은 장식을 목표로 등록.

## 2. 실제 원본 자료 조사
원본 사이트: https://hunjeh404.github.io/greek-myth-map/
원본 저장소: https://github.com/Hunjeh404/greek-myth-map
확인 브랜치: main
조사 시점 커밋: 286dfbce4bef3a9d4ca09ae6b61956043d792451

저장소 트리와 실제 데이터 파일을 읽어 아래 수량을 확인했다. 이미지를 전부 육안 검수하거나 오디오를 청취한 결과는 아니다.

| 자원 | 실제 확인 | 재사용 |
| --- | --- | --- |
| images/portraits/*.png | 456개 | 인물·생물·집단 392개 + 보물 64개 |
| images/scenes/*.png | 98개 | 이야기책, 벽 액자, 배경 후보 |
| images/icons/*.png | 27개 | 메뉴·분류 아이콘 |
| images/ui/*.png | 7개 | 배경·프레임·로고 등 |
| audio/*.mp3 | 9개 | 배경음악·완료음 후보, 청취 후 매핑 |
| data.js | people 456개, edges 1,147개 | 고유 ID·이름·종류·상징·설명·관계 |
| book.js | 16장 | 장면 경로·인물 연결·이야기·퀴즈 |
| stories.js | 인물별 긴 이야기 | 도감의 선택 읽기 |
| timeline.js / en.js | 파일 존재 확인 | 초기 범위 밖, 내용 추가 검수 필요 |

data.js의 456개 항목 모두 images/portraits/{id}.png가 존재한다. book.js가 참조한 장면 이미지 경로에도 누락이 없었다. 파일 존재 확인은 그림 품질·투명도 검수와 별개다.
README의 인물 392·관계 939 설명은 최신 data.js 전체를 반영하지 못한다. 숫자는 실행 데이터와 파일 목록을 기준으로 한다.
현재 저장소 전체 파일 크기는 대략 136 MiB다. 게임 시작 시 전량 다운로드하지 않는다.

인물 데이터 필드: id, ko, en, ro, cat, al, dom, sym, look, ep.
book.js: 장별 n, t, sub, b, q. b의 k=img 항목에 f(그림 경로), who(인물 ID), cap(설명)가 있다.
분류: pri 14, tit 26, oly 14, god 59, nym 25, mon 64, mor 120, grp 2, her 68, art 64.
인물 원본 ID를 유지하고 게임 아이템 ID는 decor_lyre 등 별도 이름공간을 쓴다.

## 3. 첫 출시 범위
첫 출시는 가족 및 초대한 친구가 이용하는 비공개 관계망을 기본으로 한다. 전체 사용자 검색·공개 피드·실시간 채팅·동시 캐릭터 이동은 포함하지 않는다.
- 반응형 모바일 웹앱: Android Chrome / iPhone Safari / 태블릿·PC.
- 4×4, 6×6, 9×9 스도쿠.
- 실내 1개와 정원 1개, 안내 친구 4명, 배치 가능 아이템 30종.
- 모든 배치 아이템에 최소 1개 의미 있는 터치 반응. 그중 10종은 고유 반응, 3종은 작은 놀이.
- 12개 단계의 입문 여정과 반복 플레이.
- 온라인 진행 저장, 가족 연결, 집 방문, 80자 방명록·스티커, 게임 내 우편함.
- 16장 이야기책은 콘텐츠 기반을 활용하되 첫 출시에는 선정한 3장부터 공개. 나머지는 준비중으로 정확히 표시하거나 숨긴다.
- 결제·광고·에너지 제한·연속출석 초기화 없음.
- 실시간 온라인 대전, 아이템 거래, 자유 채팅, UGC 이미지 업로드는 후속 범위.

4명은 헤스티아(집 안내), 아테나(퍼즐 안내), 아폴론(음악·전시), 아르테미스(정원)로 시작한다. 이는 게임 속 역할 배정이며 원전 사실 설명과 구분한다.

## 4. 화면과 이동
하단 탭: 내 집 / 스도쿠 / 친구 / 도감. 상단 우편함·설정·현재 프로필.
스도쿠 중에는 하단 탭 대신 퍼즐 조작을 우선하고 나가기 전 저장 상태를 표시한다.

| 화면 | 핵심 내용 | 주요 행동 |
| --- | --- | --- |
| 시작 | 선물 편지, 로그인, 최근 프로필 | 이어하기 |
| 내 집 | 실내/정원 전환, 목표 아이템 | 꾸미기·터치·우편함 |
| 스도쿠 선택 | 보드 크기, 난이도, 이어하기 | 시작 |
| 퍼즐 | 보드·입력·메모·힌트 | 완료·중단 |
| 결과 | 보상, 다음 장식까지 남은 별빛 | 배치 또는 집으로 |
| 꾸미기 | 보관함·상점·배치 편집 | 구매·이동·보관·저장 |
| 친구 | 가족·초대한 친구·견본 집 | 방문 |
| 방문 | 상대 집·소개·전시품 | 터치·방명록 |
| 방명록 | 글·스티커·작성자·날짜 | 작성·자기 글 삭제 |
| 도감 | 인물·보물·그림책 | 설명 읽기 |
| 설정 | 소리·효과·도움·계정·기기 연결 | 변경 |

390px 폭 세로 화면을 기준으로 설계하되 360px에서도 가로 넘침이 없어야 한다. 숫자판은 손가락으로 누르기 충분한 크기, 주요 조작은 44px 이상을 목표로 한다. 스도쿠 칸은 보드 크기에 따라 작아질 수 있으므로 입력 버튼을 크게 둔다.
숫자는 장식 글꼴 대신 선명한 고딕 계열. 색상만으로 정답·오류·선택을 구분하지 않는다.
배경은 크림·민트·라벤더·파우더 블루. 참고 팔레트 #EDE7D6, #C7E1D7, #DCCFE5, #BDCFE0, #F0DEAA, 선 #3A3739.
계정·DB·GitHub 같은 개발 용어는 게임 화면에 노출하지 않는다.

## 5. 스도쿠 규칙·난이도·힌트
4×4는 2×2 박스, 6×6은 2×3 박스, 9×9는 3×3 박스. 일반 스도쿠 규칙을 따른다.
9×9는 쉬움·보통·어려움 3단계. 첫 출시에서는 풀이 엔진으로 설명할 수 있는 범위까지만 제공한다.
난이도를 빈칸 개수만으로 판정하지 않는다. 모든 문제는 유일해를 검증하고 논리 풀이 엔진으로 필요한 기법을 기록한다.
입문은 naked single / hidden single, 보통은 후보 제거·locked candidate·pair 범위 등으로 정의하고 실제 풀이 결과에 따라 검증한다. 논리 풀이가 막히는 문제는 해당 난이도에 넣지 않는다.
빌드/콘텐츠 준비 단계에서 검증된 문제 은행을 만들고 런타임에는 문제 ID로 제공한다. 첫 출시 최소 4×4 24문제, 6×6 48문제, 9×9 난이도별 60문제(총 252문제). 동형 변환만으로 콘텐츠 수를 과장하지 않는다.
반복 문제는 최근 출제 기록으로 줄인다.

필수 조작:
- 칸 선택 후 숫자 입력. 숫자 우선 입력 모드는 후속.
- 후보 메모 토글, 지우기, undo/redo.
- 같은 숫자·해당 행/열/박스 강조.
- 기본 숫자는 수정 불가.
- 메모 자동 제거는 설정으로 제공하고 undo가 메모 변화도 복구.
- 규칙 충돌 표시와 정답 확인을 분리.
- 시간 표시 기본 꺼짐, 제한시간·실수 생명 없음.
- 완료는 모든 칸이 차고 규칙·초기 숫자·서버 정답 검증을 통과할 때만.

힌트는 4단계: 볼 영역 → 생각할 규칙 → 구체적 배제 이유 → 요청 시 숫자 입력.
힌트 설명은 현재 보드에서 실제로 성립하는 논리로 생성한다. 모순된 입력이 있으면 먼저 모순 또는 잘못된 가정 해소를 안내한다. 추론하지 않고 답만 보여주는 경우에는 '정답 보기'라고 표시한다.
생성형 AI 호출 없이 규칙 기반 설명을 사용한다.
힌트 무료, 힌트 사용으로 재화·여정 보상 차감 금지. 무힌트 완료는 자기 기록 배지만 제공.
숫자 대신 그림을 쓰는 모드는 4×4 선택 옵션이며 숫자 모드 전환 가능.

## 6. 보상과 성장
재화는 별빛 1종. 스도쿠 완료 보상 제안: 4×4 10, 6×6 20, 9×9 쉬움 30·보통 40·어려움 50.
가격 제안: 작은 장식 20, 중형 60, 고유 놀이 보물 120. 구매 전 반응 미리보기 제공.
첫 완료는 세 장식 중 하나를 무료 선택. 첫 3판 안에 안내 친구 추가 또는 고유 놀이 보물 1개 지급.
여정은 완료 횟수로 진행하며 난이도·보드 크기·힌트 사용과 무관하게 1판=1칸.
이 수치는 출시 전 실제 플레이로 조정한다. 쉬운 보드만 해도 전체 핵심 보상을 얻을 수 있어야 한다.
재플레이도 새 시도 ID로 완료하면 보상 가능. 동일 시도의 중복 요청은 보상 1회.
정답 칸마다 보상 지급 금지. 상점 할인 타이머·기간 한정 상실·확률형 뽑기 금지.
가구는 최초 해금과 추가 수량 구매를 구분. 예: 벤치 1개 구매면 동시에 1개만 배치. 보관하면 수량 복구.
같은 가구 색상 변경은 해금한 팔레트만. 원본 그림을 무차별 색상 필터로 변형하지 않는다.
가족 공동 목표는 초기 확장 기능: 완료한 시도 ID별 기여 1회, 개인 보상과 별개로 가족 공동 장식 해금. 모두 소유권을 얻으며 사용으로 소모하지 않는다.

## 7. 집 꾸미기
실내와 정원은 2D 3/4 시점의 디오라마. 첫 버전에서 3D 모델이나 자유 카메라 구현을 요구하지 않는다.
각 공간에 12×10 논리 격자. 표시 투영과 실제 셀 좌표를 분리한다. 실내 벽 슬롯은 바닥 격자와 별도.
레이어: 배경 → 바닥/러그 → 바닥 가구 → 위에 놓는 소품 → 벽 장식 → 효과/UI.
큰 가구는 footprint(w,h)를 차지하고 바닥 가구끼리는 충돌 금지. 러그 위 가구는 허용. 테이블 위 소품은 supportSlot을 제공하는 가구만 허용하고 부모 가구 이동 시 함께 이동.
임의 회전·좌우 반전으로 인물 얼굴이나 방향이 깨지지 않게 한다. 회전은 실제 방향별 그림이 있는 아이템만 허용.
집 모드에서 탭은 상호작용, 꾸미기 모드에서 탭은 선택. 드래그 임계치를 두어 이동 중 반응이 실행되지 않게 한다.
긴 누르기만으로 중요한 기능을 숨기지 않는다. 이동·보관·취소 버튼 제공.
꾸미기 로컬 undo/redo 지원. 완료 버튼은 서버 저장 성공 후 종료하고 실패 시 초안 유지.
친구에게는 마지막 저장된 배치만 보인다. 편집 중인 초안은 전송하지 않는다.
유효하지 않은 배치·미보유 아이템·초과 수량은 서버에서 거부.

## 8. 가구 상호작용
'반응형'은 화면 크기 대응과 별개로 '터치 상호작용'을 뜻한다.
반응 유형:
A. 짧은 효과(흔들림, 빛, 소리).
B. 상태 전환(켜짐/꺼짐, 전시 그림 선택).
C. 작은 놀이(악기 음, 별 잇기, 이야기 넘기기).
장식 클릭이 아이템 이동·재화 지급·퀘스트 보상을 반복 발생시키지 않는다.
연속 터치 제한, 효과 동시 재생 상한, 소리 중첩 상한을 둔다. 모션 줄이기 설정에서는 정적 상태 전환으로 대체한다.

실제 보유 원본을 사용하는 고유 상호작용 제안:
| 아이템 ID | 원본 | 반응 | 제작 조건 |
| --- | --- | --- | --- |
| decor_lyre | portraits/lyre.png | 악기 확대창에서 7개 음 터치 | 현별 핫스폿/별도 버튼, 음원 또는 합성음 |
| decor_psyche_lamp | portraits/psyche_lamp.png | 불빛 켜기·끄기, 작은 빛 입자 | 원본 유지 + 빛 오버레이 |
| decor_ariadne_thread | portraits/ariadne_thread.png | 실이 별들을 잇는 짧은 놀이 | 실은 별도 벡터 효과 |
| decor_wind_bag | portraits/wind_bag.png | 바람이 지나가며 구름 흔들림 | 원본 + 바람 효과 |
| decor_cornucopia | portraits/cornucopia.png | 과일·꽃 장식이 잠깐 나타남 | 별도 작은 입자 그림 필요 |
| decor_olive_tree | portraits/olive_tree.png | 나뭇잎 흔들림·빛 점 | 자연스러운 수관 변형은 레이어 필요 |
| decor_golden_fleece | portraits/golden_fleece.png | 금빛 윤곽이 흐름 | 마스크 검수 필요 |
| decor_ariadne_crown | portraits/ariadne_crown.png | 왕관 위 별자리 표시 | 벡터 별 효과 |
| decor_mirror_shield | portraits/mirror_shield.png | 고른 인물 그림이 나타남 | 반사면 마스크 필요 |
| decor_pandora_jar | portraits/pandora_jar.png | 항아리 주변 희망의 빛 | 실제 개폐는 추가 그림 필요, 보상 뽑기 아님 |

위 반응은 게임용 창작 연출이다. 원전의 보물 능력으로 단정하지 않는다.
기본 가구 20종의 정적 원본은 `images/furniture/`에 모두 준비했다. 실제 목록과 파일 경로는 `asset-manifest.json`을 따른다. 배치 보정 및 터치 효과 코딩은 남아 있다. 서로 다른 원본 아이템 ID 30개가 출시 기준이며 단순 색상 변형은 별도 1종으로 세지 않는다.
생활 가구 세트는 이번 패키지에 포함했다. 보물·가구의 개폐 프레임은 포함하지 않는다. 기존 그림만으로 모든 애니메이션을 완성할 수 있다고 보고하지 말 것.

방문 시:
- 가구 반응을 자유롭게 체험.
- 방문자의 조작은 방문 세션에만 적용. 집주인 가구 설정 불변.
- 전시 그림·음악·숨은 쪽지는 집주인의 공개 설정 읽기.
- 방문 자체를 이유로 반복 재화 지급하지 않는다.
- 실내 소리가 겹치지 않도록 BGM 감쇠·효과음 볼륨 별도 설정.

## 9. 친구·방명록·우편함
실시간 동시 접속은 불필요하다. 상대가 오프라인이어도 마지막 저장된 집에 방문 가능.
관계는 가족 그룹 또는 수락된 친구 관계. 전체 사용자 닉네임 검색은 첫 출시 제외.
초대는 서버 발급 만료형 코드, 수락 뒤에만 관계 생성. 단순 사용자 ID를 안다고 접근 허용하지 않는다.
방문 목록에 닉네임·프로필·집 이름·최종 꾸미기 저장일 표시. 접속 여부가 불확실하면 온라인 표시하지 않는다.
방명록 80자(사용자가 보는 문자 기준), 스티커 1개, 작성자 ID는 인증 정보로 결정.
작성자 본인과 집주인은 삭제 가능. 집주인이 타인의 글 본문을 수정할 수는 없다.
수신자가 집을 비공개로 바꾸거나 친구를 끊으면 서버가 다음 요청부터 접근·작성 차단.
본문은 일반 텍스트로 렌더링. HTML·스크립트·임의 URL 실행 금지. 서버 길이 검증과 예: 30초당 1건 제한.
쓰기 요청 UUID로 중복 방지. 성공 전 '보냄' 표시 금지. 실패 시 초안 유지.
새 방명록 알림은 게임 내 우편함. 푸시 알림·이메일 자동 발송은 첫 출시 범위 밖.
집주인 환영 문구 60자, 가구 속 숨은 쪽지 60자, 오늘의 전시품 1개.
숨은 쪽지 발견 기록은 방문자별로 저장 가능하나 경제 보상 없음.
견본 집과 시스템 대사는 '견본 집'으로 명확히 구분. 가짜 사용자 활동을 생성하지 않는다.

## 10. 계정과 가족 사용
성인은 이메일 OTP 등 관리형 인증으로 로그인, 게임 닉네임은 별도.
아이에게 개인 이메일을 필수로 요구하지 않는 보호자 관리 프로필을 제공한다.
권장 구현:
- 성인 인증 사용자가 가족과 아이 프로필을 생성.
- 아이 단말은 관리형 익명 인증 세션을 만든 뒤 만료형 기기 연결 요청을 표시.
- 보호자가 로그인한 화면에서 요청을 확인·승인하면 서버가 그 인증 사용자에게 해당 아이 프로필의 player 권한만 부여.
- 그 기기에서 닉네임만 고른다고 다른 프로필 권한을 얻을 수 없음.
- 기기 연결은 custom application 기능이며 Supabase 기본 자동 기능이라고 가정하지 말 것.
- 아이 단말 세션을 잃어도 프로필과 진행은 서버에 남음. 보호자가 새 단말을 연결하고 기존 접근을 해제.
- 익명 인증의 '세션을 잃으면 같은 인증 사용자로 재접속 불가' 특성을 프로필 ACL로 보완한다.
- 부모 연결 전 익명 사용자는 체험 외 가족 데이터 접근·방명록 작성 불가.
- 기기 연결 코드 만료·시도 횟수 제한·1회 사용 처리, 짧은 PIN만으로 원격 계정 인증 금지.
초기 개발 부담이 크면 성인 이메일 로그인 + 보호자가 로그인한 기기의 관리 프로필 선택으로 1차 구현할 수 있으나, 독립된 아이 기기 권한·복구가 미완성임을 문서에 명시한다. 완성본 기준은 보호자 기기 연결까지 포함.

## 11. 기술 구성 권장안
프런트엔드: TypeScript + React + Vite. 정확한 버전은 구현 시 안정 버전 확인 후 lockfile 고정.
렌더링: DOM/CSS 기반 2D 집과 SVG 효과. 별도 대형 게임 엔진은 필수 아님.
백엔드: Supabase Auth + Postgres + RLS + 필요한 Edge Functions/RPC.
배포: 독립된 정적 웹 호스팅. 기존 greek-myth-map은 유지. GitHub Pages 사용 시 하위 경로·라우팅·인증 redirect를 검증.
원본 자원: GitHub에서 승인된 스냅샷을 새 프로젝트로 복사. 운영 중 원본 main을 매번 읽는 방식 금지.
사용자 진행·방명록: DB 저장. GitHub 커밋으로 저장하지 않는다.
게임 실행에 LLM/API 키는 필요 없음.
비용은 가족 규모의 실제 사용량과 제공업체 현재 정책으로 계산. 무료 지속·정액 보장 문구 금지. 계정·프로젝트 생성/유료 변경은 구현 완료와 구분해 보고.
클라이언트에는 공개용 프로젝트 키만. 관리자 비밀 키·DB 접속 문자열은 서버 전용.
인증 없는 로컬 데모를 온라인 완성본으로 보고하지 않는다.

## 12. 데이터 모델과 권한
모든 테이블에 마이그레이션, 필요한 인덱스·외래키·제약을 둔다.
| 테이블 | 주요 필드 | 권한 |
| --- | --- | --- |
| profiles | id, nickname, avatar_id, settings | 본인 ACL 수정, 친구용 필드만 별도 노출 |
| profile_access | profile_id, auth_user_id, role, revoked_at | 서버/보호자 승인 흐름만 변경 |
| families / family_members | family_id, profile_id, role | 보호자 관리, 허용 가족 조회 |
| friendships / invites | 양쪽 profile_id, status, expires_at | 당사자·서버 검증 |
| device_requests | token_hash, requester_uid, expiry, status | 제한된 승인 API 전용 |
| homes | profile_id, room_layout, garden_layout, revision | 주인 수정, 허용 관계 읽기 |
| inventory | profile_id, item_id, quantity, variants | 구매/보상 트랜잭션으로 변경 |
| wallets / reward_ledger | profile_id, balance, event_key, amount | 서버 전용 변경 |
| puzzle_catalog | id, size, givens, difficulty, version | 공개 문제 정보 조회 |
| puzzle_solutions | puzzle_id, solution | 외부 노출 없는 스키마 |
| puzzle_attempts | id, profile_id, puzzle_id, board, notes, revision, status | 본인만 저장·조회 |
| quest_progress / unlocks | profile_id, key, state | 서버 계산 |
| guestbook | id, home_owner, author, text, sticker, created_at | 허용 방문객 작성, 집주인·작성자 삭제 |
| notifications | recipient_profile_id, kind, ref, read_at | 수신자 조회·읽음 처리 |
| discovered_notes | visitor_profile_id, home_id, note_id | 방문자 기록 |
| family_goals / contributions | family_id, attempt_id, contribution | 후속, 서버 1회 반영 |

프로필 고유 ID는 인증 사용자 ID와 별개. RLS는 profile_access의 유효 권한을 매번 확인. 가족 관계만으로 남의 인벤토리·진행 수정 권한을 주지 않는다.
보호자 역할 변경·가족 가입·친구 수락·기기 승인·재화 변경은 클라이언트가 직접 임의 행 수정 불가.
친구가 조회할 수 있는 집 데이터와 비공개 퍼즐 기록을 분리한다. 이메일·인증정보를 방문 데이터에 포함하지 않는다.
RLS와 DB grant를 함께 구성. 외부 노출 스키마는 모든 테이블 점검. 관리자 권한 사용 함수는 호출자 인증·프로필 ACL·입력 검증을 함수 내부에서 수행.
사용자 본인이 재화 잔액 필드를 직접 수정할 수 있게 만드는 정책 금지.

## 13. 핵심 서버 동작
함수명은 제안이며 동일 계약을 지키면 변경 가능.
- start_attempt(profile_id, size, difficulty): 권한 확인, 문제 선택, 시도 생성. 풀이 정답 미반환.
- save_attempt(attempt_id, expected_revision, board, notes, operation_id): 형식·기본칸 확인, 버전 일치 시 저장.
- complete_attempt(attempt_id, operation_id): 서버가 초기칸·최종해 검증. 시도 상태 전환+별빛+여정+알림을 트랜잭션 처리. 반복 호출은 동일 결과.
- purchase_item(profile_id, item_id, operation_id): 서버 카탈로그 가격, 잔액 검사, 차감과 보유 수량 추가 원자 처리.
- save_home(profile_id, expected_revision, layout, operation_id): 보유량·좌표·겹침·허용 상태 검증 후 저장.
- visit_home(owner_profile_id): 현재 방문 권한 확인 후 공개용 데이터만 반환.
- post_guestbook(owner_profile_id, text, sticker_id, operation_id): 작성 권한·길이·속도 제한 확인, 글과 알림 원자 처리.
- create_invite / accept_invite / revoke_friend: 만료·당사자·상태 검증.
- approve_device / revoke_device: 보호자 권한 확인 후 profile_access 부여/회수.
중복 방지는 operation_id에만 의존하지 않는다. 완료 보상은 attempt_id별 고유 제약으로 한 번만 지급한다.
모든 오류는 재시도 가능 여부와 사용자용 메시지를 반환하고 원본 초안을 보존한다.

## 14. 자동 저장과 충돌
서버 데이터가 기준. 단말 임시 저장은 네트워크 장애와 브라우저 종료 대비용.
입력 즉시 로컬 기록, 온라인 저장은 약 1~2초 debounce 및 화면 이탈 시 시도. 종료 이벤트 전송 성공은 보장하지 않는다.
홈 편집은 임시 초안 저장, 친구에게는 저장 완료한 revision만 공개.
UI 상태: 저장 중 / 저장됨 / 연결 끊김·임시 보관 / 충돌·선택 필요.
동일 프로필을 여러 기기에서 편집하면 expected_revision 비교 후 오래된 저장 거부. '서버 상태 불러오기' 또는 '내 초안 확인 후 다시 저장'을 제공, 조용한 덮어쓰기 금지.
연결 끊김 중 진행 중 퍼즐 입력은 유지 가능. 구매·방명록 전송·새 보상 확정은 서버 승인 필요. 오프라인 보상 잔액을 진짜처럼 표시하지 않는다.
다른 프로필 로그인 시 이전 프로필의 대기 요청을 전송하지 않는다. 임시 저장 키는 인증 사용자·프로필·시도 ID로 구분한다.
방문객이 누른 조명 상태는 서버 homes 업데이트로 이어지지 않는다.

## 15. 콘텐츠·에셋 처리
원본 리포지토리에서 필요한 자원만 복사하고 원본 ID·경로·커밋을 asset manifest에 기록한다.
그림마다 width/height/alpha/내용 bbox/여백/용도/앵커/footprint/인터랙션/추가 제작 상태를 검수한다.
이미지가 정사각형 불투명 초상이라면 우선 카드·액자·전시 패널로 사용한다. 억지 배경 제거·자동 전신 생성으로 대체하지 않는다.
침대·책장·분수·문·개폐 가구 등 추가 에셋은 별도 제작 목록으로 관리. 개발 임시 도형은 최종 아트로 간주하지 않는다.
로고는 기존 관계도 제목 포함 여부 확인 후 새 게임용 텍스트 로고로 교체.
원본 PNG 보존. 배포용 WebP 등 파생 파일은 눈·선·투명 가장자리 검수 후 만들고 원본 경로 매핑 유지.
그림 588개와 음악 9개 전체를 초기 번들에 넣지 않는다. 초기 UI·기본 집 자원 우선, 도감·장면·음악은 필요 시 로드.
초기 로드 전송량 목표 5MB 이하(음악 제외), 집 동시 배치 초기 상한 60개, 구형 모바일에 맞춰 효과 수 제한.
오디오는 청취한 뒤 배정. 최초 사용자 동작 후 재생, BGM/효과음 볼륨 분리, 탭 비활성 시 정지.
기존 신화 이야기는 출처 데이터이지 사실 검증 완료본이 아니다. 선별 페이지를 검토하고 게임 창작 대사와 구분한다. 신화 퀴즈는 스도쿠 보상의 필수 조건이 아니다.

아이템 매니페스트 예시(신규 기획 값이며 실측값 아님):
```json
{
  "id": "decor_lyre",
  "sourceId": "lyre",
  "sourcePath": "images/portraits/lyre.png",
  "sourceCommit": "286dfbce4bef3a9d4ca09ae6b61956043d792451",
  "displayName": "작은 리라",
  "placement": "display",
  "footprint": {"w": 1, "h": 1},
  "assetReview": "pending",
  "interaction": {
    "type": "instrument",
    "cooldownMs": 150,
    "visitorCanUse": true,
    "visitorPersistsState": false
  },
  "unlock": {"type": "shop", "price": 120}
}
```
assetReview가 pending이면 자연스러운 가구 배치 완료로 표시하지 않는다. sourcePath는 실제 존재 확인됨. 픽셀 좌표는 아직 미측정.

## 16. 개발 순서와 통과 기준
A. 자료 가져오기·목록 생성
- 원본 기준 커밋 기록, JSON 변환, 경로 검증, 대표 이미지 육안 검수.
- 기존 456 항목·98 장면 매핑, 필요한 신규 가구 목록 확정.
B. 스도쿠 엔진
- 크기별 규칙·유일해·논리 힌트·메모·undo/redo 검증.
- 최소 문제 은행 생성과 풀이 가능성 검사.
C. 온라인 계정·저장
- 성인 로그인, 프로필 ACL, 아이 기기 연결·복구, 실제 DB 저장.
D. 한 바퀴 완성
- 한 판 완료 → 서버 보상 → 가구 구매 → 배치 → 재접속 후 유지.
E. 방문·방명록
- 두 계정·두 기기에서 서로 방문, 가구 조작, 글 작성·삭제·읽음.
F. 콘텐츠 확대·모바일 검수
- 30 아이템, 10 고유 반응, 3 작은 놀이, 안내 친구 4명, 여정 12단계.
G. 출시 인계
- 배포 절차, 환경변수 예시, DB 마이그레이션, 실제 검수 결과, 알려진 제한.

최종 인수 테스트:
1. 4/6/9 보드 모두 잘못된 숫자·기본칸 변경·거짓 완료 거부.
2. 동일 완료 요청 10회에 보상 1회. 구매 이중 탭에도 거래 1회.
3. 힌트의 행·열·박스 설명이 실제 보드와 맞음.
4. 프로필 A가 B의 퍼즐·재화·집을 수정할 수 없음.
5. 친구는 허용 집을 읽고 방명록만 작성, 친구 해제 후 접근 차단.
6. 방문자가 조명·전시품을 조작해도 주인 설정 불변.
7. 방명록 스크립트 문자열이 텍스트로만 표시.
8. 연결 끊김 중 입력 후 복구, 실패 초안 유지, 서버 승인 전 보상 미확정.
9. 같은 프로필 두 기기 동시 편집 시 충돌 안내, 오래된 버전 덮어쓰기 없음.
10. 아이 단말 세션 소실 후 보호자 재연결로 기존 진행 복구, 회수한 기기 접근 차단.
11. 360px 화면에서 숫자·메모·힌트·키보드·방명록 입력이 가려지지 않음.
12. 모션 줄이기·음소거 상태에서도 모든 기능 사용.
13. 에셋 경로 누락·깨진 그림·오디오 로드 실패가 화면 전체를 중단시키지 않음.
14. 배포 환경에서 실제 2명 플레이, 새로고침·로그아웃·재로그인까지 확인.

단위 테스트는 스도쿠·거래 중복·배치 검증에 집중하고, DB 권한 테스트와 두 사용자 E2E를 필수로 둔다. 단순 버튼 스냅샷 수를 성과로 보고하지 않는다.
외부 서비스 접근이 없으면 로컬에서 가능한 구현·마이그레이션·검증을 끝내고 남은 연결 단계와 검수 미완료를 명시한다.

## 17. Claude 시작 지시문
아래 문장을 이 문서와 함께 전달한다.

> 첨부 명세서대로 그리스신화 온라인 스도쿠·집 꾸미기 게임을 구현해 주세요. 기존 https://github.com/Hunjeh404/greek-myth-map 은 자원 원본이며 기존 사이트를 수정하지 말고 새 프로젝트로 작업하세요. 실제 이미지와 데이터를 먼저 확인하고, 부족한 가구·애니메이션 그림은 목록화하세요. 원본 데이터 ID를 유지하고 원본 스냅샷을 기록하세요. 먼저 스도쿠 한 판 → 서버 보상 → 가구 구매 → 배치 저장 → 두 번째 사용자 방문 → 방명록 작성까지 이어지는 실제 동작을 완성한 뒤 콘텐츠를 확대하세요. 관리자 키를 클라이언트에 넣지 말고, RLS와 서버 거래 검증을 구현하세요. 목업·로컬 저장만으로 온라인 기능을 완료했다고 보고하지 마세요. 코드, DB 마이그레이션, 환경변수 예시, 에셋 매니페스트, 테스트 결과, 실행·배포 설명서를 제공하세요. 서비스 연결이 막혀도 가능한 작업을 끝낸 뒤 정확히 필요한 설정만 알려주세요.

## 18. 공식 기술 참고자료
조회일 2026-10-15. 정확한 SDK·요금·배포 설정은 구현 시 재확인.
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- 이메일 인증: https://supabase.com/docs/guides/auth/auth-email-passwordless
- 익명 인증과 세션 제약: https://supabase.com/docs/guides/auth/auth-anonymous
- 서버 함수: https://supabase.com/docs/guides/functions

## 부록 A. 실제 보유 보물 64종

| 원본 ID | 이름 | 이미지 경로 |
| --- | --- | --- |
| thunderbolt | 제우스의 번개 | images/portraits/thunderbolt.png |
| aegis | 아이기스 | images/portraits/aegis.png |
| trident | 포세이돈의 삼지창 | images/portraits/trident.png |
| helm_darkness | 하데스의 투명 투구 | images/portraits/helm_darkness.png |
| caduceus | 헤르메스의 지팡이 | images/portraits/caduceus.png |
| talaria | 날개 달린 샌들 | images/portraits/talaria.png |
| lyre | 리라 | images/portraits/lyre.png |
| eros_arrows | 에로스의 금화살과 납화살 | images/portraits/eros_arrows.png |
| cestus | 아프로디테의 허리띠 | images/portraits/cestus.png |
| thyrsus | 티르소스 | images/portraits/thyrsus.png |
| harpe | 하르페 | images/portraits/harpe.png |
| fate_thread | 운명의 실 | images/portraits/fate_thread.png |
| asclepius_rod | 아스클레피오스의 지팡이 | images/portraits/asclepius_rod.png |
| twin_bows | 아폴론과 아르테미스의 활 | images/portraits/twin_bows.png |
| golden_throne | 헤라의 황금 옥좌 | images/portraits/golden_throne.png |
| sun_chariot | 태양 마차 | images/portraits/sun_chariot.png |
| cornucopia | 풍요의 뿔 | images/portraits/cornucopia.png |
| ambrosia | 암브로시아와 넥타르 | images/portraits/ambrosia.png |
| pomegranate | 페르세포네의 석류 | images/portraits/pomegranate.png |
| omphalos | 포대기에 싼 돌 | images/portraits/omphalos.png |
| pan_pipes | 판의 피리 | images/portraits/pan_pipes.png |
| athena_aulos | 아테나의 피리 | images/portraits/athena_aulos.png |
| olive_tree | 아테나의 올리브 나무 | images/portraits/olive_tree.png |
| ariadne_crown | 아리아드네의 왕관 | images/portraits/ariadne_crown.png |
| fennel_fire | 회향 줄기 속 불씨 | images/portraits/fennel_fire.png |
| pandora_jar | 판도라의 항아리 | images/portraits/pandora_jar.png |
| deucalion_ark | 데우칼리온의 방주 | images/portraits/deucalion_ark.png |
| heracles_club | 헤라클레스의 몽둥이 | images/portraits/heracles_club.png |
| lion_pelt | 네메아의 사자 가죽 | images/portraits/lion_pelt.png |
| heracles_bow | 헤라클레스의 활 | images/portraits/heracles_bow.png |
| hesperides_apples | 헤스페리데스의 황금 사과 | images/portraits/hesperides_apples.png |
| race_apples | 경주의 황금 사과 | images/portraits/race_apples.png |
| discord_apple | 불화의 황금 사과 | images/portraits/discord_apple.png |
| kibisis | 페르세우스의 자루 | images/portraits/kibisis.png |
| mirror_shield | 거울 방패 | images/portraits/mirror_shield.png |
| graiai_eye | 그라이아이의 눈 | images/portraits/graiai_eye.png |
| golden_bridle | 황금 굴레 | images/portraits/golden_bridle.png |
| ariadne_thread | 아리아드네의 실타래 | images/portraits/ariadne_thread.png |
| daedalus_wings | 다이달로스의 날개 | images/portraits/daedalus_wings.png |
| black_sail | 검은 돛 | images/portraits/black_sail.png |
| aegeus_sword | 바위 밑의 칼과 샌들 | images/portraits/aegeus_sword.png |
| golden_fleece | 황금 양털 | images/portraits/golden_fleece.png |
| argo | 아르고호 | images/portraits/argo.png |
| jason_sandal | 이아손의 한쪽 샌들 | images/portraits/jason_sandal.png |
| dragon_teeth | 용의 이빨 | images/portraits/dragon_teeth.png |
| harmonia_necklace | 하르모니아의 목걸이 | images/portraits/harmonia_necklace.png |
| achilles_armor | 아킬레우스의 갑옷과 방패 | images/portraits/achilles_armor.png |
| pelian_spear | 펠리온의 물푸레나무 창 | images/portraits/pelian_spear.png |
| trojan_horse | 트로이 목마 | images/portraits/trojan_horse.png |
| palladium | 팔라디온 | images/portraits/palladium.png |
| odysseus_bow | 오디세우스의 활 | images/portraits/odysseus_bow.png |
| wind_bag | 바람 자루 | images/portraits/wind_bag.png |
| moly | 몰리 | images/portraits/moly.png |
| penelope_shroud | 페넬로페의 베 | images/portraits/penelope_shroud.png |
| charon_obol | 카론의 뱃삯 | images/portraits/charon_obol.png |
| boar_hide | 칼리돈 멧돼지 가죽 | images/portraits/boar_hide.png |
| bronze_rattle | 청동 딸랑이 | images/portraits/bronze_rattle.png |
| hippolyta_belt | 히폴리테의 허리띠 | images/portraits/hippolyta_belt.png |
| golden_cup | 헬리오스의 황금 잔 | images/portraits/golden_cup.png |
| sisyphus_stone | 시시포스의 바위 | images/portraits/sisyphus_stone.png |
| psyche_lamp | 프시케의 등불 | images/portraits/psyche_lamp.png |
| beauty_box | 아름다움의 상자 | images/portraits/beauty_box.png |
| ivory_statue | 상아 조각상 | images/portraits/ivory_statue.png |
| arachne_loom | 아라크네의 베틀 | images/portraits/arachne_loom.png |

## 부록 B. 이야기 장 목록

1. 세상의 시작
2. 티탄의 시대
3. 신들의 전쟁
4. 올림포스의 신들
5. 사람의 탄생
6. 신들을 만난 사람들
7. 사랑과 노래
8. 페르세우스와 날개 달린 말
9. 크레타의 미궁
10. 헤라클레스의 열두 과업
11. 테바이 이야기
12. 황금 양털을 찾아서
13. 사냥꾼 아탈란테
14. 트로이 전쟁의 씨앗
15. 트로이 전쟁
16. 오디세우스의 긴 귀향

## 부록 C. 오디오 후보

- audio/Before_the_Stars.mp3
- audio/Laurel_Crown.mp3
- audio/Oracle_Quiz.mp3
- audio/Orpheus_Lyre.mp3
- audio/Picnic_on_Olympus.mp3
- audio/Road_of_Heroes.mp3
- audio/The_Long_Way_Home.mp3
- audio/Threads_of_Olympus.mp3
- audio/Thunder_on_the_Mountain.mp3



## 23. v1.1 일러스트 인계 추가사항

이 절과 동봉한 `README.md`, `asset-manifest.json`, `interaction-spec.json`이 신규 가구 그림과 배치 방식의 최신 기준이다. 본문의 기존 보물 10종 재사용 규칙은 유지한다. 원본 사이트의 데이터 파일이나 화면 코드는 이 작업에서 수정하지 않았다.

- 신규 배경: 빈 실내, 구름 정원. 신규 생활 가구: 20종. 모두 1254×1254 투명 PNG.
- 기존 보물 10종과 합쳐 30종을 계획한다. 배경 2장은 가구 종수에 포함하지 않는다.
- 기존 보물용 `decor_*` ID는 유지한다. 신규 20종은 매니페스트 ID를 게임 카탈로그의 기본 ID로 사용하고 저장 이후 변경하지 않는다.
- 전시 받침대·찻상의 지원 슬롯은 첫 구현에서 수동 접지·겹침 검수를 마친 뒤 활성화한다.
- 벽 장식은 배경 뒤 벽 위, 바닥 가구 아래 레이어다. 본문 7절의 고정 나열보다 실제 접지점 Y 정렬과 부모-자식 레이어를 우선한다.
- 에셋 수가 준비됐다는 사실은 게임 출시·상호작용·애니메이션이 완성됐다는 의미가 아니다.
- 배경 2:1 투영은 목표값이며 그림의 픽셀은 완전한 2:1을 보장하지 않는다. 배경별 수동 바닥 폴리곤에 논리 좌표를 매핑한다.
- 바닥 좌표 매핑은 순서가 back/right/front/left인 사각형에 정규화된 (u,v)를 bilinear interpolation하는 방식으로 시작할 수 있다. 좌표 역변환과 경계·충돌은 별도로 검증한다.
- 모바일 가독성, 가구 겹침, 44px 이상의 터치 대상, 모션 줄이기, 로딩·저장 실패 복구를 실제 화면에서 확인한다.
