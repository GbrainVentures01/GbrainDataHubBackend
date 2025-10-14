module.exports = {
  routes: [
    {
      method: "POST",
      path: "/buy-exam-pin",
      handler: "exam-pin-order.create",
    },
    {
      method: "POST",
      path: "/buy-exam-pin/mobile",
      handler: "exam-pin-order.mobileBuyExamPin",
    },
  ],
};
