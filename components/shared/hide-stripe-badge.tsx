"use client";

import { useEffect } from "react";

export function HideStripeBadge() {
  useEffect(() => {
    function removeBadge() {
      document.querySelectorAll<HTMLElement>(
        'iframe[name*="privateStripeController"], iframe[name*="stripeLink"], iframe[title*="Stripe Link"], [data-js-forms-banner]'
      ).forEach(el => {
        const parent = el.parentElement;
        if (parent && parent !== document.body) {
          parent.style.display = "none";
        } else {
          el.style.display = "none";
        }
      });
    }

    removeBadge();

    const observer = new MutationObserver(removeBadge);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
