export type CartItem={productId:string;variantId?:string|null;quantity:number};
/** A quantity control affects one line and removes it only when it reaches zero. */
export function changeQuantity<T extends CartItem>(items:T[],index:number,delta:number):T[]{
 return items.map((item,i)=>i===index?{...item,quantity:Math.min(99,Math.max(0,item.quantity+delta))}:item).filter(item=>item.quantity>0);
}
