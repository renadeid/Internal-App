export const sharedAssetMaxBytes = 20 * 1024 * 1024
export type SharedAsset = {
 id:string;name:string;description:string;type:string;tags:string[];collection:string;visibility:string;
 ownerId:string;ownerName:string|null;createdAt:string;updatedAt:string;externalUrl:string|null;
 canEdit:boolean;canDelete:boolean;hasFile:boolean;versionId:string|null;fileName:string|null;mime:string|null;size:number|null;
 projects:{id:string;name:string}[]
}
export type SharedAssetDraft={name:string;description:string;tags:string[];collection:string;visibility:"company"|"project_members";projectId:string}
export type SharedAssetAccess={role:string;canUpload:boolean;projects:{id:string;name:string}[]}
export const sharedFileKinds:Record<string,{mime:string;type:string}>= {
 jpg:{mime:"image/jpeg",type:"image"},jpeg:{mime:"image/jpeg",type:"image"},png:{mime:"image/png",type:"image"},webp:{mime:"image/webp",type:"image"},
 pdf:{mime:"application/pdf",type:"document"},docx:{mime:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",type:"document"},
 xlsx:{mime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",type:"document"},pptx:{mime:"application/vnd.openxmlformats-officedocument.presentationml.presentation",type:"presentation"},
 zip:{mime:"application/zip",type:"other"},txt:{mime:"text/plain",type:"document"},csv:{mime:"text/csv",type:"document"},mp4:{mime:"video/mp4",type:"video"},
}
export function sharedFileKind(name:string) {return sharedFileKinds[name.toLowerCase().split(".").pop()??""]}
export function validateSharedDraft(input:SharedAssetDraft):SharedAssetDraft {
 if(!input||typeof input.name!=="string"||!input.name.trim()||input.name.trim().length>120||typeof input.description!=="string"||input.description.length>4000||typeof input.collection!=="string"||input.collection.length>80||!Array.isArray(input.tags)||input.tags.length>20||input.tags.some(t=>typeof t!=="string"||t.length>40)||!["company","project_members"].includes(input.visibility)||typeof input.projectId!=="string"||(input.projectId&&!/^[0-9a-f-]{36}$/i.test(input.projectId))||(input.visibility==="project_members"&&!input.projectId))throw Error("Complete the file name and access settings. Use up to 20 tags.")
 return {...input,name:input.name.trim(),description:input.description.trim(),collection:input.collection.trim()||"General",tags:[...new Set(input.tags.map(t=>t.trim()).filter(Boolean))]}
}
export function fileSizeLabel(bytes:number|null){if(bytes===null)return "No file";return bytes<1024*1024?`${Math.ceil(bytes/1024)} KB`:`${(bytes/1024/1024).toFixed(1)} MB`}
