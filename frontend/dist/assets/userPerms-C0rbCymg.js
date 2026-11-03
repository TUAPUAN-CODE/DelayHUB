const a=e=>{try{return JSON.parse(localStorage.getItem("perms")||"[]").includes(e)}catch{return!1}},s=()=>a("scan_sap_only"),t=()=>a("manual_trolley");export{t as c,s as m};
