# 토익 퀴즈

파트·유닛별 토익 문제와 암기 퀴즈를 풀고 해설과 오답 노트로 복습하는 학습 앱입니다.
기본 787문항과 암기 589문항, 총 1,376문항을 담고 있으며 오프라인에서도 동작합니다.

- **바로 풀어보기:** https://toeic-teal-zeta.vercel.app

## 기능

- Part 5 문법·어휘, Part 6, Part 7 및 유닛별 범위 선택
- 연습·실전·예제·암기 유형과 문제 수 선택
- 답안 제출 후 문제 해설 표시
- 객관식, O/X, 직접 입력, 바꿔 쓰기 문제
- 문장 빈칸, 헷갈리는 형용사 쌍, 전치사 필요 여부, 품사·동사 형태 분류 문제
- 암기 전치사 문제는 보기에서 다른 유효 전치사를 제외하고, 동사는 자동사·타동사로 분류
- 지문에 속한 문제는 함께 묶은 채로 순서 섞기
- 이어 풀기, 오답 노트, 설정을 브라우저(localStorage)에 저장
- 오프라인 캐시와 홈 화면 설치(PWA)

> 오프라인으로 쓰려면 먼저 온라인 상태에서 한 번 접속해 서비스 워커 설치를 마쳐야 합니다.
> 브라우저 데이터를 지우면 학습 기록도 함께 삭제됩니다.

## 기술 스택

- [Next.js](https://nextjs.org) 16 (App Router), React 19, TypeScript
- 퀴즈 화면: 순수 JavaScript (`public/static/app.js`)
- 오프라인: 서비스 워커 (`public/sw.js`), 오프라인 전용 화면 (`public/offline.html`)
- 배포: [Vercel](https://vercel.com)

오프라인 화면은 온라인 화면과 같은 퀴즈를 Next.js 런타임 없이 실행합니다.

## 로컬 실행

```powershell
npm.cmd install
npm.cmd run dev
```

http://localhost:3000 에서 확인합니다.

## 데이터

| 구분 | 경로 |
| --- | --- |
| 원본 문제 | `data/questions_raw.json` |
| 암기 목록 | `data/memo_src.txt` |
| 해설 | `data/exp/*.txt` (`문제ID\|해설` 형식, `\n`은 줄바꿈) |
| 이전 암기 ID 대응표 | `data/memo_legacy_ids.json` |
| 변환 스크립트 | `scripts/build-bank.mjs`, `scripts/build-memo.mjs` |
| 출력 | `public/bank.json` (`/api/bank`로도 제공) |

개발 서버를 시작하거나 빌드할 때 데이터가 자동으로 변환됩니다. 변환 중에 문항 수, ID 중복, 정답 선택지, 지문 참조를 검증합니다.
암기 목록을 수정했다면 개발 서버를 다시 시작하거나 다시 빌드하세요. 암기 ID 대응표 덕분에 남아 있는 문제의 학습 기록은 이전되고, 삭제된 문제의 기록은 정리됩니다.

## 검증

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

## 배포

GitHub 저장소가 Vercel 프로젝트에 연결되어 있어 `main` 브랜치에 푸시하면 https://toeic-teal-zeta.vercel.app 에 자동 배포됩니다.
다른 브랜치에 푸시하면 미리보기 배포가 만들어집니다. 추가 환경 변수나 별도 서버는 필요하지 않습니다.
