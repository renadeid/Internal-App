export const artifactMaxBytes=512*1024
export type ArtifactDocument={id:string;title:string;fileName:string;createdAt:string|null;authorName:string;content?:string;reference?:boolean}
export function validateArtifactFile(fileName:string,content:string,title:string){
 if(typeof fileName!=="string"||typeof content!=="string"||typeof title!=="string")throw Error("Choose a Markdown or text file.")
 const name=fileName.replace(/[\\/\r\n]/g,"_").trim()
 if(!/\.(md|markdown|txt)$/i.test(name)||name.length>180)throw Error("Choose an .md, .markdown or .txt file with a name up to 180 characters.")
 if(!content.trim()||content.includes("\u0000"))throw Error("Choose a non-empty text file.")
 if(new TextEncoder().encode(content).byteLength>artifactMaxBytes)throw Error("Choose a file up to 512 KB.")
 if(!title.trim()||title.trim().length>160)throw Error("Enter a title up to 160 characters.")
 return {file_name:name,content,title:title.trim()}
}
