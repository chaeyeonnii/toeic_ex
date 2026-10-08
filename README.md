# 토익 퀴즈

Next.js App Router 기반의 토익 학습 앱입니다. 새 압축 파일의 원본 화면과 기본 787문항, 암기 589문항(총 1,376문항)을 이식했습니다.

## 실행

```powershell
npm.cmd install
npm.cmd run dev
```

http://localhost:3000 에서 확인합니다.

## 기능

- Part 5 문법·어휘, Part 6, Part 7 및 유닛별 범위 선택
- 연습·실전·예제·암기 유형과 문제 수 선택
- 답안 제출 후 문제 해설 표시
- 암기 전치사 문제는 보기에서 다른 유효 전치사를 제외하고, 동사는 자동사·타동사 두 가지로 분류
- 문장 빈칸, 헷갈리는 형용사 쌍, 전치사 필요 여부, 품사·동사 형태 분류 문제
- 지문에 속한 문제를 함께 유지하며 순서 섞기
- 객관식, O/X, 직접 입력, 바꿔 쓰기 문제와 결과 확인
- localStorage에 이어 풀기, 오답 노트, 설정 저장
- HTTPS 또는 localhost에서 오프라인 캐시 및 홈 화면 설치

오프라인 사용 전 온라인 상태에서 한 번 접속해 서비스 워커 설치를 완료해야 합니다.
오프라인 탐색은 동일한 화면의 `public/offline.html`을 사용하므로 Next.js 런타임 없이도 퀴즈가 작동합니다.
브라우저 데이터를 지우면 학습 기록도 삭제됩니다.

## 데이터와 검증

원본: `data/questions_raw.json`
암기 목록: `data/memo_src.txt` (수정 후 개발 서버 재시작 또는 빌드)
해설: `data/exp/*.txt` (`문제ID|해설`, `\\n`은 줄바꿈)
변환: `scripts/build-bank.mjs`
암기 변환: `scripts/build-memo.mjs` (Node.js로 생성하며 Python은 필요하지 않습니다)
이전 암기 ID 대응표: `data/memo_legacy_ids.json` (유지된 문제의 기록은 이전하고 삭제된 문제의 기록은 정리)
출력: `public/bank.json` (`/api/bank`로도 제공)

개발 서버 시작과 빌드 전에 데이터가 자동 변환됩니다. 변환 과정에서 문항 수, ID 중복, 정답 선택지, 지문 참조를 검증합니다.

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

## Vercel

GitHub 저장소 `chaeyeonnii/toeic_ex`를 Import하고 Next.js 기본 설정으로 배포합니다.
추가 환경 변수나 Python 서버는 필요하지 않습니다.
