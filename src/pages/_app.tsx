import type { AppProps } from 'next/app'
import Head from 'next/head'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>러닝 챌린지</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="친구들과 함께하는 주간 러닝 챌린지" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
