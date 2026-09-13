document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.lead-form').forEach(form=>{
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const button=form.querySelector('button[type="submit"]');
      const original=button.textContent;
      button.disabled=true;
      button.textContent='SENDING...';
      let status=form.querySelector('.form-status');
      if(!status){status=document.createElement('p');status.className='form-status notice';button.closest('p').after(status);}
      status.textContent='';
      const fd=new FormData(form);
      const payload={
        name:fd.get('name'),
        phone:fd.get('phone'),
        zip:fd.get('zip'),
        problem:fd.get('problem'),
        preferred_contact:fd.get('contact'),
        _subject:`NEW FurnaceCheckNow Lead - ${fd.get('zip')||''}`,
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
        status.textContent='Request received. We’ll follow up about your furnace request.';
        form.reset();
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
