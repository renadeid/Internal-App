import {ArtifactReader} from "@/components/artifacts/artifact-reader"
export default async function ArtifactPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ArtifactReader id={id}/>}
