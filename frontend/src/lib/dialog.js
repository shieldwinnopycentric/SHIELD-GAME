import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

// Dialog konfirmasi bergaya pixel (SweetAlert2) — pengganti window.confirm
// bawaan browser ("localhost says"). Style-nya diatur lewat customClass yang
// memetakan ke utilitas pixel/palet di index.css (buttonsStyling: false biar
// SweetAlert tidak memasang warna sendiri).
//
// Mengembalikan Promise<boolean>: true kalau pemain menekan tombol konfirmasi.
export function confirmDialog({
  title = "Yakin?",
  text = "",
  confirmText = "Ya",
  cancelText = "Batal",
  danger = false,
} = {}) {
  return Swal.fire({
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true, // Batal di kiri, aksi utama di kanan
    focusCancel: true,
    buttonsStyling: false,
    customClass: {
      popup: "shield-swal-popup pixel-card",
      title: "shield-swal-title",
      htmlContainer: "shield-swal-text",
      actions: "shield-swal-actions",
      confirmButton: `shield-swal-btn pixel-btn text-void ${danger ? "bg-danger" : "bg-primary"}`,
      cancelButton: "shield-swal-btn pixel-btn bg-line text-parchment",
    },
  }).then((res) => res.isConfirmed);
}
