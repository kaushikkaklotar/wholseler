export class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
export async function api<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(`/api/v1${path}`,{...init,credentials:"same-origin",headers:{...(init?.body&&!(init.body instanceof FormData)?{"Content-Type":"application/json"}:{}),...init?.headers}});
  if(!response.ok){let message="Unable to complete the request";try{const body=await response.json();message=Array.isArray(body.message)?body.message.join(", "):body.message||message;}catch{}throw new ApiError(response.status,message);}
  return response.json() as Promise<T>;
}
export const send=<T>(path:string,data:unknown,method="POST")=>api<T>(path,{method,body:JSON.stringify(data)});
export function errorMessage(error:unknown){return error instanceof Error?error.message:"Unable to complete the request";}
export const date=(value:string|Date,options?:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",day:"numeric",month:"short",...options}).format(new Date(value));
export const time=(value:string)=>new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",hour:"numeric",minute:"2-digit"}).format(new Date(value));
