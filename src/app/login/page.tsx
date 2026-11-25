import { Suspense } from "react"
import type { Metadata } from "next"
import { LockKeyhole } from "lucide-react"
import { LoginForm } from "@/app/login/login-form"
import { LoginScene } from "@/app/login/login-scene"
import { BrandLogo } from "@/components/shared/brand-logo"
import styles from "./login.module.css"
import { LoginBackground } from "./login-background"

export const metadata: Metadata = { title: "Sign in" }
export default function LoginPage() {
 return <main className={styles.page}>
  <LoginBackground />
  <header className={styles.pageHeader}><div className={styles.brand}><BrandLogo className="w-32"/><span>Connect</span></div><span className={styles.workspaceLabel}><span/>Roaya workspace</span></header>
  <div className={styles.pageBody}><LoginScene />
  <section className={styles.formSide} aria-labelledby="login-heading">
   <div className={styles.formContent}>
    <div className={styles.formEyebrow}><LockKeyhole size={15} aria-hidden/>Your space to do great work</div>
    <h1 id="login-heading">Welcome back.</h1>
    <p className={styles.formLead}>Your team, projects and ideas are right where you left them.</p>
    <div className={styles.form}><Suspense fallback={<p role="status">Loading sign-in…</p>}><LoginForm/></Suspense></div>
    <div className={styles.accessNote}><p>New to Roaya Connect?<br/><span>Your administrator can set up your access.</span></p></div>
   </div>
  </section></div>
  <footer className={styles.formFooter}><span>Less searching. More creating.</span><span>Built around your team.</span></footer>
 </main>
}
