const mysql = require("mysql");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const jwtSecret = "Best-Rest-CAdmin";

const conn = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Sasha228",
  database: "BRC",
});

class courController {
  async getReadyOrders(req, res) {
    try {
      // SQL-запрос для получения заказов с данными пользователя, только с ID_статуса = 3
      const getOrdersQuery = `
            SELECT 
              Заказ.ID AS orderId,
              Заказ.Дата_заказа AS orderDate,
              Заказ.Время_заказа AS orderTime,
              Заказ.Время_доставки AS deliveryTime,
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
            WHERE Статус_заказа.ID = 3
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
      const authHeader = req.headers.authorization;

      // Проверка наличия токена
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          message: "Сессия была закончена, авторизуйтесь заново",
        });
      }

      const token = authHeader.split(" ")[1];

      // Расшифровка токена и извлечение ID сотрудника
      let decodedToken;
      try {
        decodedToken = jwt.verify(token, jwtSecret);
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: "Сессия была закончена, авторизуйтесь заново",
        });
      }

      const adminId = decodedToken.id; // Извлекаем ID сотрудника из токена
      // Получаем orderId и employeeId из тела запроса
      const { orderId } = req.body;

      if (!orderId || !adminId) {
        return res.status(400).json({
          success: false,
          message: "ID заказа и ID сотрудника обязательны",
        });
      }

      // Запрос для обновления статуса заказа
      const updateOrderStatusQuery =
        "UPDATE Заказ SET ID_статуса = 4 WHERE ID = ? AND ID_статуса = 3";

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

        // Обновляем запись в таблице "Заказ", устанавливая ID_сотрудника
        const updateOrderQuery = `
                UPDATE Заказ
                SET ID_сотрудника = ?
                WHERE ID = ?
                `;

        conn.query(
          updateOrderQuery,
          [adminId, orderId], // adminId - ID сотрудника, orderId - ID заказа
          (err, results) => {
            if (err) {
              console.error("Ошибка при обновлении заказа:", err);
              return res.status(500).json({
                success: false,
                message: "Ошибка при обновлении заказа",
              });
            }
            res.status(200).json({
              success: true,
              message: "Заказ принят и запись о принятии добавлена",
            });
          }
        );
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка на сервере при принятии заказа",
      });
    }
  }

  async getCourOrders(req, res) {
    try {
      const authHeader = req.headers.authorization;

      // Проверка наличия токена
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          message: "Сессия была закончена, авторизуйтесь заново",
        });
      }

      const token = authHeader.split(" ")[1];

      // Расшифровка токена и извлечение ID сотрудника
      let decodedToken;
      try {
        decodedToken = jwt.verify(token, jwtSecret);
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: "Сессия была закончена, авторизуйтесь заново",
        });
      }

      const adminId = decodedToken.id; // Извлекаем ID сотрудника из токена

      // SQL-запрос для получения заказов, принадлежащих текущему сотруднику
      const getOrdersQuery = `
      SELECT 
          Заказ.ID AS orderId,
          Заказ.Дата_заказа AS orderDate,
          Заказ.Время_заказа AS orderTime,
          Заказ.Время_доставки AS deliveryTime,
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
      WHERE Статус_заказа.ID = 4 
      AND Заказ.ID_сотрудника = ? 
      ORDER BY Заказ.Дата_заказа, Заказ.Время_заказа;
    `;

      const orders = await new Promise((resolve, reject) => {
        conn.query(getOrdersQuery, [adminId], (err, results) => {
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

  async completeOrder(req, res) {
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

      const adminId = decodedToken.id;
      const { orderId } = req.body;

      if (!orderId || !adminId) {
        return res.status(400).json({
          success: false,
          message: "ID заказа обязателен",
        });
      }

      const updateOrderStatusQuery = `
        UPDATE Заказ 
        SET ID_статуса = 5, Время_доставки = CURRENT_TIME() 
        WHERE ID = ? AND ID_статуса = 4
      `;

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
            message: "Заказ не найден или уже выдан",
          });
        }

        res.status(200).json({
          success: true,
          message: "Заказ выдан",
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

  async getStoryOrders(req, res) {
    try {
      const authHeader = req.headers.authorization;

      // Проверка наличия токена
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          message: "Сессия была закончена, авторизуйтесь заново",
        });
      }

      const token = authHeader.split(" ")[1];

      // Расшифровка токена и извлечение ID сотрудника
      let decodedToken;
      try {
        decodedToken = jwt.verify(token, jwtSecret);
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: "Сессия была закончена, авторизуйтесь заново",
        });
      }

      const adminId = decodedToken.id; // Извлекаем ID сотрудника из токена

      // SQL-запрос для получения заказов, принадлежащих текущему сотруднику
      const getOrdersQuery = `
            SELECT 
                Заказ.ID AS orderId,
                Заказ.Дата_заказа AS orderDate,
                Заказ.Время_заказа AS orderTime,
                Заказ.Время_доставки AS deliveryTime,
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
            WHERE Статус_заказа.ID = 5 
            AND Заказ.ID_сотрудника = ? 
            ORDER BY Заказ.Дата_заказа, Заказ.Время_заказа;
          `;

      const orders = await new Promise((resolve, reject) => {
        conn.query(getOrdersQuery, [adminId], (err, results) => {
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
}

module.exports = new courController();
