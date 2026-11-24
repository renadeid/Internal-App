import {BrandLogo} from "@/components/shared/brand-logo"
import styles from "./login.module.css"
export function LoginScene(){return <section className={styles.scene} aria-label="Roaya Connect workspace introduction">
 <header className={styles.sceneHeader}><div className={styles.brand}><BrandLogo className="w-28"/><span>Connect</span></div></header>
 <div className={styles.sceneCopy}><p className={styles.eyebrow}><span/>The Roaya way of working</p><h2>Good work.<br/><span>Better together.</span></h2><p>Bring every project, conversation and shared resource into one connected workspace.</p></div>
 <footer className={styles.sceneFooter}>Less searching. More creating.</footer>
 </section>}
export function LoginAtmosphere(){return <div className={styles.ambient} aria-hidden>
 <div className={styles.colourField}/><div className={styles.colourMist}/><div className={styles.grid}/>
 <svg className={styles.silk} viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" fill="none"><g><path d="M250 -100C100 200 600 310 460 620S270 880 440 1100"/><path d="M272 -100C120 200 620 310 478 620S290 880 458 1100"/><path d="M300 -100C170 200 650 310 500 620S315 880 480 1100"/></g><g><path d="M1180 -100C1450 240 1030 320 1160 580S1490 780 1300 1100"/><path d="M1200 -100C1470 240 1050 320 1180 580S1510 780 1320 1100"/></g><g><path d="M-100 780C300 720 450 80 880 140S1320 630 1700 290"/><path d="M-100 790C300 730 450 95 880 155S1320 645 1700 300"/></g></svg>
 <div className={styles.vignette}/>
 </div>}
