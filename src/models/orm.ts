import VuexORM from "@vuex-orm/core";
import User from "@/models/user.model";

/**
 * Register all the Models here.
 * https://vuex-orm.org/guide
 */
const db = new VuexORM.Database();
db.register(User);

export const orm = db;
