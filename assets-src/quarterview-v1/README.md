# 올림포스의 작은 정원 — 쿼터뷰 일러스트 팩 v1

온라인 스도쿠 게임의 실내·정원 꾸미기용 **배경 2장 + 가구 20종**. 모두 1254×1254 RGBA PNG이며 투명 배경이다. 기존 Greek Myth Map의 크림·금빛·연보라·세이지 수채화 분위기를 따랐다.

## 사용 순서

1. 이 폴더를 원본 저장소의 `sudoku-assets/quarterview-v1/`에 추가한다.
2. `PROJECT_SPEC.md`로 게임 범위를 읽고 `CLAUDE_TASK.md`를 개발 지시문으로 사용한다.
3. `asset-manifest.json`에서 실제 파일 경로·크기·알파 바운드·배치 초깃값을 읽는다.
4. `interaction-spec.json`에 따라 효과와 화면 연결을 구현한다.
5. 배경 위에서 가구 스케일·접지점·벽 슬롯을 조정한 뒤 온라인 저장·방문을 검증한다.

## 파일 안내

| 파일 | 내용 |
| --- | --- |
| images/environments/ | 빈 실내·정원 배경 2장 |
| images/furniture/ | 생활 가구 20종 |
| asset-manifest.json | 실측 크기·경계·해시와 배치 초깃값 |
| interaction-spec.json | 터치 반응 20종의 구현 명세 |
| validation.json | 알파·여백 검사와 남은 확인 사항 |
| PROJECT_SPEC.md | 온라인 게임 전체 개발 명세 v1.1 |
| CLAUDE_TASK.md | Claude에 전달할 작업 지시 |
| generation-prompts.json | 채택한 원본의 생성 지시문 |

## 구현할 때 지킬 점

- **쿼터뷰 확정.** 그림은 손그림 디오라마이며 정확한 2:1 타일셋이 아니다. 논리 격자 12×10과 화면 투영을 분리한다. 바닥 모서리·가구 앵커·표시 크기는 첫 배치 검수에서 보정한다.
- PNG 전체가 같은 크기여도 가구의 게임 속 크기가 같은 것은 아니다. `suggestedVisibleWidthFractionOfFloor`는 전체 투명 캔버스가 아닌 주 피사체 바운드에 적용한다.
- 모든 자산은 **단일 방향의 정적 원본**이다. 분리된 레이어·열린 문/상자·애니메이션 프레임은 포함하지 않는다. 개폐 장면이 필요하면 별도 제작한다.
- 빛·물결·김·나비·별은 코드의 SVG/Canvas 오버레이로 구현한다. 모빌 별만 흔들기나 수관만 변형하기는 레이어가 없으므로 이번 버전의 완성 기능으로 주장하지 않는다.
- 신화 액자는 속이 투명하지 않은 빈 크림색 그림판이다. 1차 버전은 터치 시 갤러리를 열고, 그림판 안에 이미지를 합성하려면 수동 사각형 마스크를 먼저 검수한다.
- 문·커튼은 우측 뒤 벽용 방향이다. 임의 반전이나 회전으로 양쪽 벽에 복제하지 않는다.
- 실내 배경과 벽 장식은 가구보다 먼저 그린다. 바닥·러그 다음에 접지점 화면 Y로 가구 깊이 순서를 정한다. 받침대 위 소품은 부모를 따라간다.
- 정원 배경의 주 피사체 좌우 여백은 11/12px로 16px 기준에 미달한다. 원본을 유지하고 전체 공간 렌더러에 8% 외부 여백과 `overflow: visible`을 적용한다. 타이트한 잘라내기는 금지한다.
- 기존 보물 10종을 더해 총 30종을 구성한다. 기존 정면 보물은 받침대 위 전시나 확대창에 재사용하고, 자동으로 쿼터뷰 가구가 됐다고 취급하지 않는다.
- 이미지는 배포 시 필요한 자산만 지연 로드한다. 원본 전체를 초기 화면에서 한꺼번에 읽지 않는다. 모바일 배포본의 파생 WebP/축소본은 별도 생성·검수하되 원본을 덮어쓰지 않는다.
- 방문자의 터치 효과는 방문자 화면에만 적용한다. 방명록 외에 집주인의 전시물·배치·재화·저장 상태를 바꾸지 않는다.

## 검수 범위

22장 PNG 전체 디코딩, RGBA·투명도, 주요 피사체 경계·여백·연결요소를 확인하고 밝은/어두운 배경에서 축소 모아보기로 검수했다. 침대는 밝은/어두운 합성본도 개별 확인했다. 게임 엔진에서 배치와 효과를 실행한 결과는 아니다. 세부 결과는 `validation.json`에 있다.

## 이미지 목록

| 미리보기 | 이름 · ID | 누르면 |
| --- | --- | --- |
| <img src="images/environments/garden_base.png" width="160" alt="구름 위 정원"> | 구름 위 정원<br>`garden_base` | 꾸미기 공간 |
| <img src="images/environments/room_base.png" width="160" alt="올림포스 작은 집"> | 올림포스 작은 집<br>`room_base` | 꾸미기 공간 |
| <img src="images/furniture/cloud_bed.png" width="160" alt="구름 침대"> | 구름 침대<br>`cloud_bed` | 침대가 살짝 눌렸다 돌아오고 포근한 반짝임 |
| <img src="images/furniture/cloud_cushion.png" width="160" alt="구름 쿠션"> | 구름 쿠션<br>`cloud_cushion` | 쿠션이 말랑하게 눌렸다 복원 |
| <img src="images/furniture/display_pedestal.png" width="160" alt="보물 받침대"> | 보물 받침대<br>`display_pedestal` | 전시한 보물 설명 보기·주인은 전시물 교체 |
| <img src="images/furniture/garden_trellis.png" width="160" alt="꽃 아치"> | 꽃 아치<br>`garden_trellis` | 꽃 주변 반짝임과 나비 모양 벡터 효과 |
| <img src="images/furniture/laurel_bench.png" width="160" alt="월계수 벤치"> | 월계수 벤치<br>`laurel_bench` | 벤치 위 작은 별빛과 착석 소리 |
| <img src="images/furniture/laurel_door.png" width="160" alt="월계수 문"> | 월계수 문<br>`laurel_door` | 문종 소리 뒤 방문 목록 열기 |
| <img src="images/furniture/laurel_rug.png" width="160" alt="월계수 러그"> | 월계수 러그<br>`laurel_rug` | 러그 위 월계수 문양을 따라 빛이 한 바퀴 |
| <img src="images/furniture/linen_curtain.png" width="160" alt="리넨 커튼"> | 리넨 커튼<br>`linen_curtain` | 커튼 사이 햇살 오버레이 |
| <img src="images/furniture/music_stand.png" width="160" alt="악보대"> | 악보대<br>`music_stand` | 배경 음악 선택창·명시적인 재생 버튼 |
| <img src="images/furniture/olive_planter.png" width="160" alt="올리브 화분"> | 올리브 화분<br>`olive_planter` | 화분 위 잎 모양 효과와 바스락 소리 |
| <img src="images/furniture/owl_mailbox.png" width="160" alt="올빼미 우편함"> | 올빼미 우편함<br>`owl_mailbox` | 방명록 읽기·문구 또는 스티커 남기기 |
| <img src="images/furniture/picture_frame.png" width="160" alt="신화 액자"> | 신화 액자<br>`picture_frame` | 해금한 신화 그림 크게 보기·주인은 전시 그림 선택 |
| <img src="images/furniture/round_stool.png" width="160" alt="둥근 의자"> | 둥근 의자<br>`round_stool` | 의자가 한 번 작게 통통 |
| <img src="images/furniture/scroll_bookcase.png" width="160" alt="두루마리 책장"> | 두루마리 책장<br>`scroll_bookcase` | 해금한 신화 이야기 선택창 열기 |
| <img src="images/furniture/shell_fountain.png" width="160" alt="조개 분수"> | 조개 분수<br>`shell_fountain` | 수면에 타원 물결 두 번 |
| <img src="images/furniture/star_lantern.png" width="160" alt="별빛 등불"> | 별빛 등불<br>`star_lantern` | 등불 주변 따뜻한 빛 켜기·끄기 |
| <img src="images/furniture/star_mobile.png" width="160" alt="별 모빌"> | 별 모빌<br>`star_mobile` | 별 주변 작은 빛과 순서대로 차임 세 음 |
| <img src="images/furniture/stepping_stones.png" width="160" alt="정원 디딤돌"> | 정원 디딤돌<br>`stepping_stones` | 디딤돌 세 칸이 차례로 빛남 |
| <img src="images/furniture/tea_table.png" width="160" alt="찻상"> | 찻상<br>`tea_table` | 주전자 위로 짧은 김 오버레이 |
| <img src="images/furniture/treasure_chest.png" width="160" alt="보물 상자"> | 보물 상자<br>`treasure_chest` | 수집한 보물 진열창 열기 |
