// Va en el <head> de la portada (antes de pintar): archivo aparte para que la política de seguridad no tenga que permitir scripts en línea.
// Intro de marca: solo la primera vez por sesión y si el usuario no pidió menos movimiento.
try {
  if (!sessionStorage.getItem("motobox_intro") && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    sessionStorage.setItem("motobox_intro", "1");
    document.documentElement.classList.add("mx-intro-on");
    // Red de seguridad: si motion.js no llega a cargar, la cortina no queda puesta.
    setTimeout(function () {
      var r = document.documentElement;
      if (r.classList.contains("mx-intro-on") && !r.classList.contains("mx-intro-built")) {
        r.classList.remove("mx-intro-on");
        document.dispatchEvent(new CustomEvent("motobox:intro-done"));
      }
    }, 5000);
  }
} catch (e) {}
