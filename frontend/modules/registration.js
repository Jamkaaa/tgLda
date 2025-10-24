import axios from "axios";

export default class Registration {
  constructor() {
    this.allFields = document.querySelectorAll(
      "#registration-form .form-control"
    );
    this.insertValidationElements();

    this.username = document.querySelector("#username-register");
    this.username.previousValue = "";

    this.email = document.querySelector("#email-register");
    this.email.previousValue = "";

    this.events();
  }

  events() {
    this.username.addEventListener("keyup", () =>
      this.isDifferent(this.username, this.usernameHandler)
    );

    this.email.addEventListener("keyup", () =>
      this.isDifferent(this.email, this.emailHandler)
    );
  }

  emailHandler() {
    this.email.errors = false;
    this.emailImmediately();
    clearTimeout(this.email.timer);
    this.email.timer = setTimeout(() => this.emailAfterDelay(), 800);
  }

  emailAfterDelay() {
    if (this.email.value != "" && !/^\S+@\S+$/.test(this.email.value)) {
      this.showValidationError(this.email, "Имэйл хаяг буруу байна");
    }

    if (this.email.value.length < 6) {
      this.showValidationError(this.email, "6 тэмдэгтээс багагүй байх ёстой");
    }

    if (this.email.errors === false) {
      axios
        .post("/doesEmailExist", { email: this.email.value })
        .then((response) => {
          if (response.data === true) {
            this.showValidationError(
              this.email,
              "Энэ имэйл хаяг бүртгэлтэй байна"
            );
            this.email.isUnique = false;
          } else {
            this.email.isUnique = true;
          }
        })
        .catch(() => {
          console.log("Please try again later.");
        });
    }
  }

  emailImmediately() {
    if (this.email.value.length > 150) {
      this.showValidationError(this.email, "150 тэмдэгтээс ихгүй байх ёстой");
    }

    if (this.email.errors === false) {
      this.hideValidationError(this.email);
    }
  }

  usernameHandler() {
    this.username.errors = false;
    this.usernameImmediately();
    clearTimeout(this.username.timer);
    this.username.timer = setTimeout(() => this.usernameAfterDelay(), 800);
  }

  usernameImmediately() {
    if (
      this.username.value != "" &&
      !/^([a-zA-Z0-9]+)$/.test(this.username.value)
    ) {
      this.showValidationError(
        this.username,
        "Тусгай тэмдэгтийг оруулах боломжгүй"
      );
    }

    if (this.username.value.length > 10) {
      this.showValidationError(this.username, "10 тэмдэгтээс ихгүй байх ёстой");
    }

    if (this.username.errors === false) {
      this.hideValidationError(this.username);
    }
  }

  hideValidationError(field) {
    field.nextElementSibling.classList.remove("liveValidateMessage--visible");
  }

  showValidationError(field, message) {
    field.nextElementSibling.innerHTML = message;
    field.nextElementSibling.classList.add("liveValidateMessage--visible");
    field.errors = true;
  }

  usernameAfterDelay() {
    if (this.username.value.length < 4) {
      this.showValidationError(
        this.username,
        "4 тэмдэгтээс багагүй байх ёстой"
      );
    }

    if (this.username.errors === false) {
      axios
        .post("/doesUsernameExist", { username: this.username.value })
        .then((response) => {
          if (response.data === true) {
            this.showValidationError(
              this.username,
              "Энэ хэрэглэгчийн нэр бүртгэлтэй байна"
            );
            this.username.isUnique = false;
          } else {
            this.username.isUnique = true;
          }
        })
        .catch(() => {
          console.log("Please try again later.");
        });
    }
  }

  isDifferent(field, handler) {
    if (field.value !== field.previousValue) {
      handler.call(this);
    }
    field.previousValue = field.value;
  }

  insertValidationElements() {
    this.allFields.forEach((field) => {
      field.insertAdjacentHTML(
        "afterend",
        '<div class="alert alert-danger small liveValidateMessage"></div>'
      );
    });
  }
}
