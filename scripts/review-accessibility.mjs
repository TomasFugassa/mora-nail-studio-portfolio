import AxeBuilder from '@axe-core/playwright';
export async function staticAccessibility(page){
 await page.waitForFunction(()=>document.querySelector('.hero')?.dataset.transitioning==='false');
 // Measure the final colors, rather than a fading headline halfway through a transition.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{get:()=>true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(()=>document.querySelector('.hero')?.dataset.transitioning==='false');
 return new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
}
