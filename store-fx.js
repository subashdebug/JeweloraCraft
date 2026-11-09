/* Storefront polish: header shrink on scroll, scroll-reveal (also for dynamically rendered cards), back-to-top */
(function () {
  var header = document.getElementById("siteHeader");
  var top = document.createElement("button");
  top.className = "fx-top"; top.setAttribute("aria-label", "Back to top"); top.textContent = "↑";
  top.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
  document.body.appendChild(top);
  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle("scrolled", y > 40);
    top.classList.toggle("show", y > 600);
  }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  if (!("IntersectionObserver" in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  var SEL = ".section-head, .category-card, .product-card, .promo-card, .about-inner, .testimonial-card, .newsletter > *, .page-title, .filter-row";
  function scan() {
    document.querySelectorAll(SEL).forEach(function (el) {
      if (el.dataset.fx) return;
      el.dataset.fx = "1";
      var sibs = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.setProperty("--d", Math.min(sibs % 6, 5) * 0.08 + "s");
      el.classList.add("fx-reveal"); io.observe(el);
    });
  }
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();
