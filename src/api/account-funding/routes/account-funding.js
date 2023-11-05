"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/account-funding",
      handler: "account-funding.create",
    },
    {
      method: "POST",
      path: "/create-reserved-account",
      handler: "account-funding.generateMonnifyAccount",
    },
    {
      method: "GET",
      path: "/account-funding",
      handler: "account-funding.find",
    },
    {
      method: "GET",
      path: "/account-funding/:id",
      handler: "account-funding.findOne",
    },
    {
      method: "PUT",
      path: "/account-funding/:id",
      handler: "account-funding.update",
    },
    {
      method: "DELETE",
      path: "/account-funding/:id",
      handler: "account-funding.delete",
    },
  ],
};
