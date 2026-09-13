document.addEventListener('DOMContentLoaded',()=>{
  const normalizePhone=value=>(value||'').toString().replace(/\D/g,'').replace(/^1(?=\d{10}$)/,'');

  function plausibleUSPhone(value){
    const d=normalizePhone(value);
    if(d.length!==10) return false;
    // NANP: area code and exchange cannot begin with 0 or 1.
    if(!/[2-9]/.test(d[0]) || !/[2-9]/.test(d[3])) return false;
    // Obvious junk / repeated or simple sequences.
    if(/^(\d)\1{9}$/.test(d)) return false;
    if(['1234567890','0123456789','9876543210','0987654321'].includes(d)) return false;
    // 555-0100 through 555-0199 are reserved for fictional use.
    if(d.slice(3,6)==='555' && /^01\d\d$/.test(d.slice(6))) return false;
    return true;
  }


  async function verifyUSZip(zip){
    if(!/^\d{5}$/.test(zip)) return null;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),4500);
    try{
      const r=await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`,{signal:controller.signal});
      if(!r.ok) return null;
      const data=await r.json();
      const place=data?.places?.[0];
      if(!place) return null;
      return {city:place['place name']||'',state:place['state abbreviation']||place.state||''};
    }catch(_){
      return null;
    }finally{
      clearTimeout(timer);
    }
  }

  document.querySelectorAll('.lead-form').forEach(form=>{
    const loadedAt=Date.now();
    form.dataset.formLoaded=String(loadedAt);

    form.addEventListener('submit',async e=>{
      e.preventDefault();

      const button=form.querySelector('button[type="submit"]');
      const original=button.textContent;
      let status=form.querySelector('.form-status');
      if(!status){
        status=document.createElement('p');
        status.className='form-status notice';
        button.closest('p').after(status);
      }
      status.textContent='';

      const fd=new FormData(form);
      const honey=(fd.get('_honey')||'').toString().trim();
      const elapsed=Date.now()-Number(form.dataset.formLoaded||loadedAt);
      const lastSubmit=Number(localStorage.getItem('fcn_last_submit')||0);

      // LoJack layer 1: honeypot. Humans never see or fill this field.
      if(honey){
        status.textContent='Request received.';
        form.reset();
        return;
      }

      // LoJack layer 2: reject machine-speed submissions.
      if(elapsed < 1800){
        status.textContent='Please wait a moment and try again.';
        return;
      }

      // LoJack layer 3: browser-side burst limiter.
      if(lastSubmit && Date.now()-lastSubmit < 30000){
        status.textContent='Your request was already sent. Please wait before submitting again.';
        return;
      }

      const phone=(fd.get('phone')||'').toString();
      const zip=(fd.get('zip')||'').toString().trim();

      // Lead-quality gate: reject implausible US phone numbers before sending.
      if(!plausibleUSPhone(phone)){
        status.textContent='Please enter a valid 10-digit U.S. mobile number.';
        form.querySelector('[name="phone"]')?.focus();
        return;
      }


      button.disabled=true;
      button.textContent='VERIFYING...';

      // Verify that the ZIP exists before the lead can be submitted.
      const zipInfo=await verifyUSZip(zip);
      if(!zipInfo){
        status.textContent='We could not verify that ZIP code. Please check it and try again.';
        button.disabled=false;
        button.textContent=original;
        form.querySelector('[name="zip"]')?.focus();
        return;
      }

      button.textContent='SENDING...';

      const payload={
        name:fd.get('name'),
        phone:normalizePhone(phone),
        email:(fd.get('email')||'').toString().trim(),
        zip,
        city:zipInfo.city,
        state:zipInfo.state,
        problem:fd.get('problem'),
        preferred_contact:fd.get('contact'),
        marketing_consent:fd.get('marketing_consent')==='yes' ? 'yes' : 'no',
        _honey:'',
        _subject:`NEW FurnaceCheckNow Lead - ${zip} - ${zipInfo.city}`,
        _template:'table',
        _url:window.location.href
      };

      try{
        const response=await fetch('https://formsubmit.co/ajax/intake@furnacechecknow.com',{
          method:'POST',
          headers:{'Content-Type':'application/json','Accept':'application/json'},
          body:JSON.stringify(payload)
        });
        if(!response.ok) throw new Error('submit failed');
        localStorage.setItem('fcn_last_submit',String(Date.now()));
        status.textContent='Request received. We’ll follow up about your furnace request.';
        form.reset();
        form.dataset.formLoaded=String(Date.now());
        button.textContent='REQUEST RECEIVED ✓';
        setTimeout(()=>{button.disabled=false;button.textContent=original;},4000);
      }catch(err){
        status.textContent='We could not send your request. Please try again.';
        button.disabled=false;
        button.textContent=original;
      }
    });
  });
});
