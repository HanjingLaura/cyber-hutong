// Hide the stage on load until we know which scene the signed-in player was in,
// so a refresh never flashes the hutong before jumping to the saved room.
let released=false;
export function holdScene(timeout=10000){if(released)return;document.body.classList.add('scene-pending');setTimeout(releaseScene,timeout);}
export function releaseScene(){if(released)return;released=true;document.body.classList.remove('scene-pending');}
