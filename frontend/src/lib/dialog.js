import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

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
    reverseButtons: true,
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
