// El formulario no envía correos: arma un mensaje y abre WhatsApp.
//
// Orden deliberado: primero se abre WhatsApp y después se mide. Abrir una
// ventana solo se permite dentro del gesto del usuario, y en móvil la
// navegación corta cualquier petición pendiente; el registro viaja con
// sendBeacon, que sobrevive a la navegación.
//
// Nunca falla callado: pase lo que pase, queda a la vista un botón para abrir
// WhatsApp a mano. Ese botón lleva data-no-medir: el contacto ya se midió al
// enviar y tocarlo no es un segundo contacto.
//
// El botón de envío viene disabled en el HTML y este archivo lo habilita: sin
// JS no se envía nada (la CSP, form-action 'self', tampoco dejaría ir a wa.me)
// y el <noscript> ofrece un enlace directo. Los campos libres (f-nombre,
// f-comuna, f-motivo, f-comentario, f-receta) no llevan name, para que nunca
// viajen en una URL: aquí cada campo se lee por su id. Solo los radios de
// modalidad conservan name, que es lo que los agrupa. El action guarda el
// número de WhatsApp.
(function () {
    'use strict';

    // El número sale del action del formulario (https://wa.me/<número>), que
    // escribe tools/gen_comun.py (TELEFONO): así no hay una copia aquí que
    // olvidar al cambiar de teléfono.
    function numeroDe(formulario) {
        var m = /wa\.me\/(\d+)/.exec(formulario.getAttribute('action') || '');
        return m ? m[1] : '';
    }

    // Lo que la persona pide, tal como lo leerá Monserrat en el chat.
    // «orientacion» es la tercera opción: vive fuera de las comunas de visita
    // y todavía no tiene receta.
    var MODALIDADES = {
        evaluacion: 'una evaluación de pisada a domicilio',
        receta: 'cotizar mis plantillas con la receta que ya tengo',
        orientacion: 'saber cómo conseguir mis plantillas: vivo fuera de las comunas ' +
            'donde haces visitas y todavía no tengo receta'
    };

    // Un doble clic en «Enviar» no puede abrir dos chats ni contar dos contactos.
    var PAUSA_ENTRE_ENVIOS_MS = 1500;

    function enMovil() {
        return navigator.maxTouchPoints > 0 && window.matchMedia('(max-width: 60rem)').matches;
    }

    // Devuelve true si WhatsApp se abrió. Sin 'noopener' en las opciones de
    // window.open: con él la especificación obliga a devolver null aunque la
    // pestaña se abra, y el formulario creería que el navegador la bloqueó.
    // El opener se corta a mano en su lugar.
    function abrir(enlace) {
        if (enMovil()) {
            location.href = enlace;
            return true;
        }
        var ventana = window.open(enlace, '_blank');
        if (!ventana) return false;
        try { ventana.opener = null; } catch (e) { /* ya está aislada */ }
        return true;
    }

    function iniciar() {
        var formulario = document.getElementById('formulario-lead');
        if (!formulario) return;

        // Sin número no hay a dónde abrir: se deja el envío nativo al action.
        var numero = numeroDe(formulario);
        if (!numero) {
            if (window.creaLog) window.creaLog('formulario sin wa.me en el action: no se intercepta');
            return;
        }

        function url(mensaje) {
            return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensaje);
        }

        var salida = document.getElementById('formulario-salida');
        var botonEnviar = formulario.querySelector('[type="submit"]');
        if (botonEnviar) botonEnviar.disabled = false;
        var ultimoEnvio = 0;

        // Por id (f-nombre) y, si no está, por name: los radios de modalidad
        // se leen como grupo por su name.
        function campo(nombre) {
            return document.getElementById('f-' + nombre) || formulario.elements[nombre];
        }

        function valor(nombre) {
            var el = campo(nombre);
            if (!el) return '';
            if (el.length && !el.tagName) {            // RadioNodeList
                return el.value.trim();
            }
            if (el.type === 'checkbox') return el.checked && !el.closest('[hidden]') ? 'si' : '';
            return (el.value || '').trim();
        }

        function radios() {
            var r = campo('modalidad');
            return r && r.length ? Array.prototype.slice.call(r) : [];
        }

        // Los errores se anuncian una sola vez: al enviar, el foco va al
        // primer campo con problema y su aria-describedby lee el error. Si
        // además cada error fuera role="alert", el lector leería dos avisos a
        // la vez y se pisarían.
        formulario.querySelectorAll('.campo__error[role="alert"]').forEach(function (el) {
            el.removeAttribute('role');
        });

        // Cada radio apunta al error del grupo: al enfocar la primera opción
        // tras un envío fallido, el lector dice qué falta.
        radios().forEach(function (r) {
            var ids = (r.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
            if (ids.indexOf('error-modalidad') === -1) ids.push('error-modalidad');
            r.setAttribute('aria-describedby', ids.join(' '));
        });

        function marcarError(idError, controles, mensaje) {
            var aviso = document.getElementById(idError);
            if (aviso) {
                // El prefijo hace que el error no dependa solo del color
                // (forced-colors, lectores de pantalla).
                aviso.textContent = mensaje ? 'Error: ' + mensaje : '';
                aviso.hidden = !mensaje;
            }
            controles.forEach(function (control) {
                if (mensaje) control.setAttribute('aria-invalid', 'true');
                else control.removeAttribute('aria-invalid');
            });
        }

        function validar() {
            var problemas = [];
            var nombre = valor('nombre');
            var modalidad = valor('modalidad');
            var controlNombre = campo('nombre');

            marcarError('error-nombre', controlNombre ? [controlNombre] : [],
                nombre ? '' : 'escribe tu nombre para que Monserrat sepa con quién habla.');
            if (!nombre) problemas.push(controlNombre);

            marcarError('error-modalidad', radios(),
                modalidad ? '' : 'elige qué necesitas: una evaluación, cotizar con tu receta u orientación.');
            if (!modalidad) problemas.push(radios()[0]);
            return problemas.filter(Boolean);
        }

        // La casilla «Tengo la receta a mano» solo tiene sentido si la persona
        // eligió «Ya tengo receta». Con cualquier otra opción se esconde y se
        // desmarca, para que el mensaje no diga dos cosas que se contradicen.
        // Viene con hidden en el HTML: sin JS no aparece, porque el chat se
        // abre solo con el saludo y no tendría a dónde ir.
        var casillaReceta = campo('receta');
        var bloqueReceta = casillaReceta && casillaReceta.closest ? casillaReceta.closest('.campo') : null;

        function sincronizarReceta() {
            if (!bloqueReceta) return;
            var conReceta = valor('modalidad') === 'receta';
            bloqueReceta.hidden = !conReceta;
            if (!conReceta) casillaReceta.checked = false;
        }
        sincronizarReceta();

        function armarMensaje() {
            var nombre = valor('nombre');
            var comuna = valor('comuna');
            var modalidad = valor('modalidad');
            var motivo = valor('motivo');
            var receta = valor('receta');
            var comentario = valor('comentario');

            var partes = ['Hola Monserrat, soy ' + nombre + (comuna ? ' de ' + comuna : '') + '.'];
            partes.push('Quiero ' + (MODALIDADES[modalidad] || 'información sobre las plantillas') + '.');
            if (motivo) partes.push('Motivo: ' + motivo + '.');
            if (receta) partes.push('Tengo la receta y te la envío por este chat.');
            if (comentario) partes.push(comentario);
            return partes.join(' ');
        }

        function mostrarSalida(enlace, seAbrio) {
            if (!salida) return;
            salida.hidden = false;
            salida.innerHTML = '';

            var texto = document.createElement('p');
            texto.textContent = seAbrio
                ? 'Abriendo WhatsApp con tu mensaje listo. Si no se abrió, toca el botón.'
                : 'Tu navegador bloqueó la ventana. Toca el botón para abrir WhatsApp.';
            salida.appendChild(texto);

            var boton = document.createElement('a');
            boton.className = 'btn btn--accion';
            boton.href = enlace;
            boton.target = '_blank';
            boton.rel = 'noopener';
            boton.setAttribute('data-wa-origen', 'formulario-respaldo');
            boton.setAttribute('data-no-medir', '');
            boton.textContent = 'Abrir WhatsApp';
            salida.appendChild(boton);

            if (!seAbrio) boton.focus();
        }

        formulario.setAttribute('novalidate', 'novalidate');

        formulario.addEventListener('submit', function (e) {
            e.preventDefault();

            var ahora = Date.now();
            if (ahora - ultimoEnvio < PAUSA_ENTRE_ENVIOS_MS) return;

            var problemas = validar();
            if (problemas.length) {
                problemas[0].focus();
                return;
            }
            ultimoEnvio = ahora;

            // aria-disabled y no disabled: un botón deshabilitado pierde el
            // foco y lo manda a <body>.
            if (botonEnviar) {
                botonEnviar.setAttribute('aria-disabled', 'true');
                setTimeout(function () { botonEnviar.removeAttribute('aria-disabled'); },
                    PAUSA_ENTRE_ENVIOS_MS);
            }

            var enlace = url(armarMensaje());

            // 1. Abrir, que es lo que la persona pidió.
            var seAbrio = abrir(enlace);

            // 2. Medir. sendBeacon sobrevive a la navegación de más arriba.
            // A GA4 no va el motivo: es un dato de salud y quedaría ligado a la
            // cookie _ga. Solo la modalidad y si tiene receta.
            if (window.CreaMedicion) {
                window.CreaMedicion.evento('formulario_whatsapp', {
                    modalidad: valor('modalidad'),
                    tiene_receta: valor('receta') ? 'si' : 'no'
                });
            }
            if (window.CreaLeads) {
                window.CreaLeads.registrar({
                    origen: 'formulario',
                    modalidad: valor('modalidad'),
                    motivo: valor('motivo'),
                    comuna: valor('comuna')
                });
            }

            // 3. Dejar el enlace a la vista pase lo que pase.
            mostrarSalida(enlace, seAbrio);
        });

        // Limpiar el error en cuanto la persona corrige
        formulario.addEventListener('input', function (e) {
            var control = e.target;
            if (control === campo('nombre') && control.value.trim()) {
                marcarError('error-nombre', [control], '');
            }
        });

        formulario.addEventListener('change', function (e) {
            if (e.target.name !== 'modalidad') return;
            marcarError('error-modalidad', radios(), '');
            sincronizarReceta();
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
