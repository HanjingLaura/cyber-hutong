export const coffeeWindow=Object.freeze({scene:'manner',order:[260,216],pickup:[440,216],radius:36});
export function nearCoffee(x,y,action='order'){const at=action==='order'?coffeeWindow.order:coffeeWindow.pickup;return Number.isFinite(x)&&Number.isFinite(y)&&Math.hypot(x-at[0],y-at[1])<=coffeeWindow.radius;}
