export function PreviewPanel({url,ready}:{url?:string;ready:boolean}){return <div>{ready&&url?url:'Preview unavailable until proof passes'}</div>;}
