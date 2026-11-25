"use client"
import {useEffect,useRef} from "react"
import styles from "./login.module.css"
export function LoginBackground(){
 const ref=useRef<HTMLVideoElement>(null)
 useEffect(()=>{const preference=window.matchMedia("(prefers-reduced-motion: reduce)");const update=()=>{const video=ref.current;if(!video)return;video.muted=true;if(preference.matches){video.pause();video.currentTime=0}else{void video.play().catch(()=>{})}};update();preference.addEventListener("change",update);return()=>preference.removeEventListener("change",update)},[])
 return <div className={styles.ambient} aria-hidden><video ref={ref} className={styles.backgroundVideo} src="/brand/login/option-2.mp4" poster="/brand/login/option-2.jpg" muted autoPlay loop playsInline preload="metadata" tabIndex={-1}/><div className={styles.vignette}/><div className={styles.grid}/></div>
}
