export type TaskSubmission={id:string;revision:number;note:string;link:string|null;fileName:string|null;size:number|null;status:"pending"|"approved"|"changes_requested";reviewNote:string;createdAt:string;reviewedAt:string|null;author:string;reviewer:string}
export type TaskWorkPanel={canSubmit:boolean;canReview:boolean;submissions:TaskSubmission[]}
export function taskWorkDetails(note:string,link:string){
 if(typeof note!=="string"||note.length>4000||typeof link!=="string"||link.length>2000)throw Error("Keep the note within 4,000 characters and the link within 2,000.")
 const value=link.trim();if(value){let url:URL;try{url=new URL(value)}catch{throw Error("Enter a valid HTTPS link.")};if(url.protocol!=="https:"||url.username||url.password)throw Error("Enter an HTTPS link without embedded credentials.")}
 return {note:note.trim(),link:value}
}
export function reviewDetails(decision:string,feedback:string){
 if(!["approved","changes_requested"].includes(decision)||typeof feedback!=="string"||feedback.length>4000)throw Error("Check the review details.")
 if(decision==="changes_requested"&&!feedback.trim())throw Error("Explain what needs to change.")
 return feedback.trim()
}
