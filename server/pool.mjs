export class TaskPool{
  active=0;queue=[];
  constructor(limit=4,maxPending=24){this.limit=limit;this.maxPending=maxPending;}
  run(job){if(this.queue.length>=this.maxPending)return Promise.reject(Object.assign(new Error('请求较多，请稍后重试'),{status:429}));return new Promise((resolve,reject)=>{this.queue.push({job,resolve,reject});this.drain();});}
  drain(){while(this.active<this.limit&&this.queue.length){const t=this.queue.shift();this.active++;Promise.resolve().then(t.job).then(t.resolve,t.reject).finally(()=>{this.active--;this.drain();});}}
}
