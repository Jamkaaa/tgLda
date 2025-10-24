import Search from "./modules/search.js";
import Chat from "./modules/chat.js";
import Registration from "./modules/registration.js";

if (document.querySelector("#registration-form")) {
  new Registration();
}

// логин хийгээд орсон хүмүүст чат харагдах

if (document.querySelector("#chat-wrapper")) {
  new Chat();
}

// логин хийгээгүй хүмүүст хайх товчлуур харагдахгүй байх
if (document.querySelector(".header-search-icon")) {
  new Search();
}
