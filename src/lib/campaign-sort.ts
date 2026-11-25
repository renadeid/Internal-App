type CampaignDate = {name:string;startsOn:string;endsOn:string}
export function compareCampaigns(a:CampaignDate,b:CampaignDate,sort:string){
 if(sort==="name")return a.name.localeCompare(b.name)
 const left=sort==="starting"?a.startsOn:a.endsOn
 const right=sort==="starting"?b.startsOn:b.endsOn
 if(!left&&right)return 1
 if(left&&!right)return -1
 return left.localeCompare(right)||a.name.localeCompare(b.name)
}
