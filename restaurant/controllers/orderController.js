const mysql = require("mysql");
const jwt = require("jsonwebtoken");

const jwtSecret = "Best-Rest-C";

const conn = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Sasha228",
  database: "BRC",
});

class OrderController {
  async paymentOrder(req, res) {
    try {
      const query = `SELECT ID, Наименование FROM Способ_оплаты`;

      conn.query(query, (err, results) => {
        if (err) {
          console.error("Ошибка при получении способов:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при получении способов",
          });
        }

        res.status(200).json({
          success: true,
          payment: results,
        });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({
        success: false,
        message: "Произошла ошибка на сервере",
      });
    }
  }

  async createOrder(req, res) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          message: "Сессия была закончена, авторизуйтесь заново",
        });
      }

      const token = authHeader.split(" ")[1];
      let decodedToken;

      try {
        decodedToken = jwt.verify(token, jwtSecret);
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: "Сессия была закончена, авторизуйтесь заново",
        });
      }

      const userId = decodedToken.userId;
      const { address, totalPrice, payment, comment } = req.body;

      const currentTime = new Date();
      const hours = currentTime.getHours();
      const minutes = currentTime.getMinutes();

      if (hours < 7 || (hours === 22 && minutes > 0) || hours > 22) {
        return res.status(400).json({
          success: false,
          message: "Заказать можно только с 07:00 до 22:00",
        });
      }

      const insertAddressQuery = `INSERT INTO Адрес (Город, Улица, Дом, Квартира) VALUES (?, ?, ?, ?)`;
      conn.query(
        insertAddressQuery,
        [address.city, address.street, address.home, address.flat || null],
        (err, addressResult) => {
          if (err) {
            console.error("Ошибка при добавлении адреса:", err);
            return res.status(500).json({
              success: false,
              message: "Ошибка при добавлении адреса",
            });
          }

          const addressId = addressResult.insertId;
          const deliveryPrice = totalPrice >= 1000 ? 0 : 500;

          const insertOrderQuery = `
            INSERT INTO 
              Заказ (ID_статуса, ID_адреса, ID_пользователя, Общая_цена_блюд, Цена_доставки, ID_способа, Дата_заказа, Время_заказа, Примечания) 
            VALUES ((SELECT ID FROM Статус_заказа WHERE ID = 1), ?, ?, ?, ?, ?, CURDATE(), CURTIME(), ?)
          `;
          conn.query(
            insertOrderQuery,
            [addressId, userId, totalPrice, deliveryPrice, payment, comment],
            (err, orderResult) => {
              if (err) {
                console.error("Ошибка при добавлении заказа:", err);
                return res.status(500).json({
                  success: false,
                  message: "Ошибка при добавлении заказа",
                });
              }

              const orderId = orderResult.insertId;

              const findFoodQuery = `SELECT ID_блюда, Количество FROM Блюда_в_корзине WHERE ID_пользователя = ?`;
              conn.query(findFoodQuery, [userId], (err, foodResults) => {
                if (err || foodResults.length === 0) {
                  console.error("Ошибка при получении блюд:", err);
                  return res.status(404).json({
                    success: false,
                    message: "Блюда не найдены",
                  });
                }

                const insertFoodQuery = `INSERT INTO Блюда_в_заказе (ID_блюда, Количество, ID_заказа) VALUES ?`;
                const foodValues = foodResults.map((food) => [
                  food.ID_блюда,
                  food.Количество,
                  orderId,
                ]);

                conn.query(insertFoodQuery, [foodValues], (err) => {
                  if (err) {
                    console.error("Ошибка при добавлении блюд в заказ:", err);
                    return res.status(500).json({
                      success: false,
                      message: "Ошибка при добавлении блюд в заказ",
                    });
                  }

                  const deleteFoodQuery = `DELETE FROM Блюда_в_корзине WHERE ID_пользователя = ?`;
                  conn.query(deleteFoodQuery, [userId], (err) => {
                    if (err) {
                      console.error(
                        "Ошибка при удалении блюд из корзины:",
                        err
                      );
                      return res.status(500).json({
                        success: false,
                        message: "Ошибка при удалении блюд из корзины",
                      });
                    }

                    return res.status(200).json({ success: true });
                  });
                });
              });
            }
          );
        }
      );
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false });
    }
  }

  async removeOrder(req, res) {
    try {
      const { orderId } = req.body;
      if (!orderId) {
        return res
          .status(400)
          .json({ success: false, message: "ID заказа обязателен" });
      }

      // Получаем детали заказа
      const getOrderDetailsQuery = `
        SELECT 
          Заказ.ID AS orderId,
          Заказ.ID_адреса AS addressId
        FROM Заказ
        WHERE Заказ.ID = ? 
      `;

      const orderDetails = await new Promise((resolve, reject) => {
        conn.query(getOrderDetailsQuery, [orderId], (err, results) => {
          if (err) return reject(err);
          resolve(results[0]);
        });
      });

      if (!orderDetails) {
        return res
          .status(404)
          .json({ success: false, message: "Заказ не найден" });
      }

      const { addressId } = orderDetails;

      // Удаляем блюда из заказа
      await new Promise((resolve, reject) => {
        conn.query(
          "DELETE FROM Блюда_в_заказе WHERE ID_заказа = ?",
          [orderId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      // Удаляем сам заказ
      await new Promise((resolve, reject) => {
        conn.query("DELETE FROM Заказ WHERE ID = ?", [orderId], (err) =>
          err ? reject(err) : resolve()
        );
      });

      // Удаляем адрес
      await new Promise((resolve, reject) => {
        conn.query("DELETE FROM Адрес WHERE ID = ?", [addressId], (err) =>
          err ? reject(err) : resolve()
        );
      });

      res.status(200).json({ success: true, message: "Заказ успешно удален" });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false });
    }
  }

  // Получение заказов пользователя
  async userOrder(req, res) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          message: "Сессия была закончена, авторизуйтесь заново",
        });
      }

      const token = authHeader.split(" ")[1];
      let decodedToken;

      try {
        decodedToken = jwt.verify(token, jwtSecret);
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: "Сессия была закончена, авторизуйтесь заново",
        });
      }

      const userId = decodedToken.userId;

      // Получаем заказы пользователя
      const getOrdersQuery = `
        SELECT 
          Заказ.ID AS orderId,
          Заказ.Дата_заказа AS orderDate,
          Заказ.Время_заказа AS orderTime,
          CONCAT('г.', Адрес.город, ', ул.', Адрес.Улица, ', дом ', Адрес.Дом, 
            IF(Адрес.Квартира IS NOT NULL, CONCAT(', кв. ', Адрес.Квартира), '')) AS address,
          Статус_заказа.Наименование AS status,
          (Заказ.Общая_цена_блюд + Заказ.Цена_доставки) AS totalPrice,
          Способ_оплаты.Наименование AS paymentMethod,
          Заказ.Время_доставки AS deliveryTime,
          Заказ.Примечания AS comment
        FROM Заказ
        INNER JOIN Адрес ON Заказ.ID_адреса = Адрес.ID
        INNER JOIN Статус_заказа ON Заказ.ID_статуса = Статус_заказа.ID
        INNER JOIN Способ_оплаты ON Заказ.ID_способа = Способ_оплаты.ID
        WHERE Заказ.ID_пользователя = ?
        ORDER BY Заказ.Дата_заказа DESC, Заказ.Время_заказа DESC
      `;

      const orders = await new Promise((resolve, reject) => {
        conn.query(getOrdersQuery, [userId], (err, results) => {
          if (err) {
            return reject(err);
          }
          resolve(results);
        });
      });

      if (orders.length === 0) {
        return res.status(404).json({ success: false });
      }

      const getFoodsQuery = `
        SELECT 
          Блюда.Название AS foodName,
          Блюда_в_заказе.Количество AS quantity
        FROM Блюда_в_заказе
        INNER JOIN Блюда ON Блюда_в_заказе.ID_блюда = Блюда.ID
        WHERE Блюда_в_заказе.ID_заказа = ?
      `;

      const ordersWithFoods = await Promise.all(
        orders.map(async (order) => {
          const foods = await new Promise((resolve, reject) => {
            conn.query(getFoodsQuery, [order.orderId], (err, results) => {
              if (err) {
                return reject(err);
              }
              resolve(results);
            });
          });
          return { ...order, foods };
        })
      );

      res.status(200).json({
        success: true,
        message: "Заказы успешно получены",
        orders: ordersWithFoods,
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false });
    }
  }
}

module.exports = new OrderController();
