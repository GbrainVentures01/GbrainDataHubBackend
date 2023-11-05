"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/sell-airtime",
      handler: "sell-airtime.create",
    },
    {
      method: "POST",
      path: "/verify-airtime-otp",
      handler: "sell-airtime.verifyOtp",
    },
    {
      method: "POST",
      path: "/finalize-sell-airtime",
      handler: "sell-airtime.sellAirtime",
    },
    {
      method: "GET",
      path: "/sell-airtime",
      handler: "sell-airtime.find",
    },
    {
      method: "GET",
      path: "/sell-airtime/:id",
      handler: "sell-airtime.findOne",
    },
    {
      method: "PUT",
      path: "/sell-airtime/:id",
      handler: "sell-airtime.update",
    },
    {
      method: "DELETE",
      path: "/sell-airtime/:id",
      handler: "sell-airtime.delete",
    },
  ],
};
