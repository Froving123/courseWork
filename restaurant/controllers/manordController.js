const mysql = require("mysql");

const conn = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Sasha228",
  database: "BRC",
});

class manordController {
  async getNewOrders(req, res) {
    try {
      // SQL-запрос для получения заказов с данными пользователя, только с ID_статуса = 1
      const getOrdersQuery = `
            SELECT 
              Заказ.ID AS orderId,
              Заказ.Дата_заказа AS orderDate,
              Заказ.Время_заказа AS orderTime,
              Заказ.Примечания AS comment,
              CONCAT('г.', Адрес.город, ', ул.', Адрес.Улица, ', дом ', Адрес.Дом, 
              IF(Адрес.Квартира IS NOT NULL, CONCAT(', кв. ', Адрес.Квартира), '')) AS address,
              Статус_заказа.Наименование AS status,
              (Заказ.Общая_цена_блюд + Заказ.Цена_доставки) AS totalPrice,
              Способ_оплаты.Наименование AS paymentMethod,
              Пользователь.ID AS userId,
              Пользователь.Имя AS userName,
              Пользователь.Фамилия AS userSurname,
              Пользователь.Email AS userEmail,
              Пользователь.Номер_телефона AS userPhone
            FROM Заказ
            INNER JOIN Адрес ON Заказ.ID_адреса = Адрес.ID
            INNER JOIN Статус_заказа ON Заказ.ID_статуса = Статус_заказа.ID
            INNER JOIN Способ_оплаты ON Заказ.ID_способа = Способ_оплаты.ID
            INNER JOIN Пользователь ON Заказ.ID_пользователя = Пользователь.ID
            WHERE Статус_заказа.ID = 1
            ORDER BY Заказ.Дата_заказа, Заказ.Время_заказа;
          `;

      const orders = await new Promise((resolve, reject) => {
        conn.query(getOrdersQuery, (err, results) => {
          if (err) {
            return reject(err);
          }
          resolve(results);
        });
      });

      if (orders.length === 0) {
        return res.status(404).json({ success: false });
      }

      // SQL-запрос для получения списка блюд в заказе
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
      res
        .status(500)
        .json({ success: false, message: "Внутренняя ошибка сервера" });
    }
  }

  async acceptOrder(req, res) {
    try {
      // Получаем orderId из тела запроса
      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: "ID заказа обязателен",
        });
      }

      // Запрос для обновления статуса заказа
      const updateOrderStatusQuery =
        "UPDATE Заказ SET ID_статуса = 2 WHERE ID = ? AND ID_статуса = 1";

      conn.query(updateOrderStatusQuery, [orderId], (err, results) => {
        if (err) {
          console.error("Ошибка при принятии заказа:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при принятии заказа",
          });
        }

        if (results.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: "Заказ не найден или уже принят",
          });
        }

        res.status(200).json({
          success: true,
          message: "Заказ принят",
        });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка на сервере при принятии заказа",
      });
    }
  }

  async cancelOrder(req, res) {
    try {
      const { orderId } = req.body;
      if (!orderId) {
        return res
          .status(400)
          .json({ success: false, message: "ID заказа обязателен" });
      }

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

      const { deliveryId, contentId, addressId } = orderDetails;

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

  async getAcceptOrders(req, res) {
    try {
      // SQL-запрос для получения заказов с данными пользователя, только с ID_статуса = 2
      const getOrdersQuery = `
            SELECT 
              Заказ.ID AS orderId,
              Заказ.Дата_заказа AS orderDate,
              Заказ.Время_заказа AS orderTime,
              Заказ.Примечания AS comment,
              CONCAT('г.', Адрес.город, ', ул.', Адрес.Улица, ', дом ', Адрес.Дом, 
              IF(Адрес.Квартира IS NOT NULL, CONCAT(', кв. ', Адрес.Квартира), '')) AS address,
              Статус_заказа.Наименование AS status,
              (Заказ.Общая_цена_блюд + Заказ.Цена_доставки) AS totalPrice,
              Способ_оплаты.Наименование AS paymentMethod,
              Пользователь.ID AS userId,
              Пользователь.Имя AS userName,
              Пользователь.Фамилия AS userSurname,
              Пользователь.Email AS userEmail,
              Пользователь.Номер_телефона AS userPhone
            FROM Заказ
            INNER JOIN Адрес ON Заказ.ID_адреса = Адрес.ID
            INNER JOIN Статус_заказа ON Заказ.ID_статуса = Статус_заказа.ID
            INNER JOIN Способ_оплаты ON Заказ.ID_способа = Способ_оплаты.ID
            INNER JOIN Пользователь ON Заказ.ID_пользователя = Пользователь.ID
            WHERE Статус_заказа.ID = 2
            ORDER BY Заказ.Дата_заказа, Заказ.Время_заказа;
          `;

      const orders = await new Promise((resolve, reject) => {
        conn.query(getOrdersQuery, (err, results) => {
          if (err) {
            return reject(err);
          }
          resolve(results);
        });
      });

      if (orders.length === 0) {
        return res.status(404).json({ success: false });
      }

      // SQL-запрос для получения списка блюд в заказе
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
      res
        .status(500)
        .json({ success: false, message: "Внутренняя ошибка сервера" });
    }
  }

  async readyOrder(req, res) {
    try {
      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: "ID заказа обязателен",
        });
      }

      // Запрос для обновления статуса заказа
      const updateOrderStatusQuery =
        "UPDATE Заказ SET ID_статуса = 3 WHERE ID = ? AND ID_статуса = 2";

      conn.query(updateOrderStatusQuery, [orderId], (err, results) => {
        if (err) {
          console.error("Ошибка при изменении статуса заказа:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при изменении статуса заказа",
          });
        }

        if (results.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: "Заказ не найден или уже готов",
          });
        }

        res.status(200).json({
          success: true,
          message: "Заказ готов",
        });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка на сервере при изменении статуса заказа",
      });
    }
  }
}

module.exports = new manordController();
