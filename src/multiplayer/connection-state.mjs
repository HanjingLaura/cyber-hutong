/** Show only actionable transport/control states; the quiet state is fully live. */
export function connectionStatus({role,online,controller,events,party,partyEnabled}) {
 if(!role)return {kind:'',text:''};
 if(!online)return {kind:'offline',text:'网络已断开 · 恢复网络后自动重连'};
 if(!events&&!party)return {kind:'reconnecting',text:'正在重新连接 · 请稍候再互动'};
 if(!controller)return {kind:'viewer',text:'角色正在另一个窗口操作'};
 if(!events)return {kind:'chat',text:'聊天连接恢复中 · 移动正常'};
 if(partyEnabled&&!party)return {kind:'presence',text:'实时位置连接恢复中'};
 return {kind:'',text:''};
}
