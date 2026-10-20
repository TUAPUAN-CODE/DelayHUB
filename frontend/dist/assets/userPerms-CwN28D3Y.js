const r=e=>{try{return JSON.parse(localStorage.getItem("perms")||"[]").includes(e)}catch{return!1}},t=()=>r("manual_trolley");export{t as c};
