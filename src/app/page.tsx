import Script from "next/script";

export default function Home() {
  return (
    <>
      <div id="app"><p className="sub">문제를 불러오는 중…</p></div>
      <div id="toast" role="status" aria-live="polite" />
      <noscript>퀴즈를 풀려면 JavaScript를 활성화해 주세요.</noscript>
      <Script src="/static/app.js" strategy="afterInteractive" />
    </>
  );
}
